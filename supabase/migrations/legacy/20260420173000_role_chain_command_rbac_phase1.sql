-- ============================================================
-- KARYO OS — Role chain-of-command RBAC (phase 1)
-- Implements initial DB-level enforcement for:
-- - Tiered komandan groundwork (`level_komando`)
-- - Staff bidang write scopes (S-1/S-3/S-4)
-- - Guard/Provost discipline-read access
-- - Admin operational write separation
-- ============================================================

-- ------------------------------------------------------------
-- Helpers: role/bidang/komando from trusted DB identity
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_karyo_role_db()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.role
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id()
    AND u.is_active = TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_karyo_staff_bidang()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT;
  v_jabatan TEXT;
BEGIN
  SELECT u.role, COALESCE(u.jabatan, '')
    INTO v_role, v_jabatan
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id()
    AND u.is_active = TRUE;

  IF NOT FOUND OR v_role <> 'staf' THEN
    RETURN NULL;
  END IF;

  IF v_jabatan ILIKE 'S-1%' OR v_jabatan ILIKE '%PERS%' THEN
    RETURN 'S1';
  ELSIF v_jabatan ILIKE 'S-3%' OR v_jabatan ILIKE '%OPS%' THEN
    RETURN 'S3';
  ELSIF v_jabatan ILIKE 'S-4%' OR v_jabatan ILIKE '%LOG%' THEN
    RETURN 'S4';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_karyo_level_komando()
RETURNS command_level
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.level_komando
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id()
    AND u.is_active = TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_karyo_is_staf_bidang(p_bidang TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT public.current_karyo_staff_bidang() = UPPER(COALESCE(p_bidang, ''))
$$;

REVOKE ALL ON FUNCTION public.current_karyo_role_db() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_karyo_staff_bidang() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_karyo_level_komando() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_karyo_is_staf_bidang(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_karyo_role_db() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_karyo_staff_bidang() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_karyo_level_komando() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_karyo_is_staf_bidang(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Users management: role validation + level_komando support
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_user_with_pin(
  p_nrp     TEXT,
  p_pin     TEXT,
  p_nama    TEXT,
  p_role    TEXT,
  p_satuan  TEXT,
  p_pangkat TEXT DEFAULT NULL,
  p_jabatan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_id UUID;
  v_level_komando command_level;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role = 'admin'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_role NOT IN ('admin', 'komandan', 'staf', 'guard', 'prajurit') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN harus 6 digit angka';
  END IF;

  v_level_komando := CASE WHEN p_role = 'komandan' THEN 'PELETON'::command_level ELSE NULL END;

  INSERT INTO public.users (nrp, pin_hash, nama, role, level_komando, satuan, pangkat, jabatan)
  VALUES (
    p_nrp,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    p_nama,
    p_role,
    v_level_komando,
    p_satuan,
    p_pangkat,
    p_jabatan
  )
  ON CONFLICT (nrp) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      nama = EXCLUDED.nama,
      role = EXCLUDED.role,
      level_komando = EXCLUDED.level_komando,
      satuan = EXCLUDED.satuan,
      pangkat = EXCLUDED.pangkat,
      jabatan = EXCLUDED.jabatan,
      is_active = TRUE,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_user(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_target_id   UUID,
  p_updates     JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_new_role TEXT;
  v_new_level command_level;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  v_new_role := p_updates->>'role';
  IF v_new_role IS NOT NULL AND v_new_role NOT IN ('admin', 'komandan', 'staf', 'guard', 'prajurit') THEN
    RAISE EXCEPTION 'Invalid role: %', v_new_role;
  END IF;

  IF p_updates ? 'level_komando' THEN
    IF NULLIF(p_updates->>'level_komando', '') IS NULL THEN
      v_new_level := NULL;
    ELSE
      v_new_level := (p_updates->>'level_komando')::command_level;
    END IF;
  ELSE
    SELECT level_komando INTO v_new_level FROM public.users WHERE id = p_target_id;
  END IF;

  IF COALESCE(v_new_role, (SELECT role FROM public.users WHERE id = p_target_id)) = 'komandan'
     AND v_new_level IS NULL THEN
    RAISE EXCEPTION 'level_komando wajib untuk role komandan';
  END IF;

  IF COALESCE(v_new_role, (SELECT role FROM public.users WHERE id = p_target_id)) <> 'komandan' THEN
    v_new_level := NULL;
  END IF;

  UPDATE public.users
  SET nama          = COALESCE((p_updates->>'nama')::TEXT, nama),
      role          = COALESCE(v_new_role, role),
      level_komando = v_new_level,
      pangkat       = COALESCE((p_updates->>'pangkat')::TEXT, pangkat),
      jabatan       = COALESCE((p_updates->>'jabatan')::TEXT, jabatan),
      satuan        = COALESCE((p_updates->>'satuan')::TEXT, satuan),
      is_active     = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active),
      foto_url      = COALESCE((p_updates->>'foto_url')::TEXT, foto_url),
      updated_at    = NOW()
  WHERE id = p_target_id;
END;
$$;

-- ------------------------------------------------------------
-- Tasks: write by Komandan or Staf S-3
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_insert_task(
  p_caller_id  UUID,
  p_caller_role TEXT,
  p_judul      TEXT,
  p_deskripsi  TEXT        DEFAULT NULL,
  p_assigned_to UUID       DEFAULT NULL,
  p_assigned_by UUID       DEFAULT NULL,
  p_deadline   TIMESTAMPTZ DEFAULT NULL,
  p_prioritas  INT         DEFAULT 2,
  p_satuan     TEXT        DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  IF NOT is_feature_enabled('tasks') THEN
    RAISE EXCEPTION 'tasks feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: hanya komandan atau staf S-3 dapat membuat tugas';
  END IF;

  INSERT INTO public.tasks (judul, deskripsi, assigned_to, assigned_by, deadline, prioritas, satuan, satuan_id, status)
  VALUES (
    p_judul,
    p_deskripsi,
    p_assigned_to,
    COALESCE(p_assigned_by, v_caller_id),
    p_deadline,
    p_prioritas,
    COALESCE(p_satuan, public.current_karyo_satuan()),
    public.current_karyo_satuan_id(),
    'pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_task_status(
  p_caller_id  UUID,
  p_caller_role TEXT,
  p_task_id    UUID,
  p_status     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  IF NOT is_feature_enabled('tasks') THEN
    RAISE EXCEPTION 'tasks feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF p_status NOT IN ('pending', 'in_progress', 'done', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid task status: %', p_status;
  END IF;

  v_role := public.current_karyo_role_db();

  IF v_role = 'prajurit' THEN
    UPDATE public.tasks
    SET status = p_status, updated_at = NOW()
    WHERE id = p_task_id AND assigned_to = v_caller_id;
  ELSIF v_role = 'komandan' OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3')) THEN
    UPDATE public.tasks
    SET status = p_status, updated_at = NOW()
    WHERE id = p_task_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized: akses update status tugas ditolak';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Leave requests: write by Prajurit (self), Komandan, or Staf S-1
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_insert_leave_request(
  p_user_id UUID,
  p_caller_role TEXT,
  p_jenis_izin TEXT,
  p_tanggal_mulai DATE,
  p_tanggal_selesai DATE,
  p_alasan TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  v_role := public.current_karyo_role_db();

  IF NOT (
    (v_role = 'prajurit' AND v_caller_id = p_user_id)
    OR v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S1'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: akses input leave request ditolak';
  END IF;

  INSERT INTO public.leave_requests (user_id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan, satuan_id)
  VALUES (
    p_user_id,
    p_jenis_izin::public.leave_type,
    p_tanggal_mulai,
    p_tanggal_selesai,
    p_alasan,
    public.current_karyo_satuan_id()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_leave_request_status(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_status      TEXT,
  p_reviewed_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  IF NOT is_feature_enabled('leave_requests') THEN
    RAISE EXCEPTION 'leave_requests feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S1'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: hanya komandan atau staf S-1 yang dapat memproses izin';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.leave_requests
  SET status = p_status,
      reviewed_by = v_caller_id,
      reviewed_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ------------------------------------------------------------
-- Shift schedules & Pos Jaga: write by Komandan or Staf S-3
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_insert_shift_schedule(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_user_id UUID,
  p_tanggal DATE,
  p_shift_mulai TIME,
  p_shift_selesai TIME,
  p_jenis_shift TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  IF NOT is_feature_enabled('shift_schedule') THEN
    RAISE EXCEPTION 'shift_schedule feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: hanya komandan atau staf S-3 yang dapat mengatur jadwal shift';
  END IF;

  INSERT INTO public.shift_schedules (user_id, tanggal, shift_mulai, shift_selesai, jenis_shift, created_by)
  VALUES (p_user_id, p_tanggal, p_shift_mulai, p_shift_selesai, p_jenis_shift::public.shift_type, v_caller_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_shift_schedule(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  IF NOT is_feature_enabled('shift_schedule') THEN
    RAISE EXCEPTION 'shift_schedule feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.shift_schedules WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_nama TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.pos_jaga (nama, qr_token, is_active)
  VALUES (p_nama, gen_random_uuid()::TEXT, TRUE)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_set_pos_jaga_active(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET is_active = p_is_active
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.pos_jaga WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_rename_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_nama TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET nama = p_nama
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_rotate_pos_jaga_qr(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_qr_token TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET qr_token = p_qr_token
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ------------------------------------------------------------
-- Logistics: write by Staf S-4 only (admin restricted)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_insert_logistics_item(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_nama_item TEXT,
  p_kategori TEXT DEFAULT NULL,
  p_jumlah INT DEFAULT 0,
  p_satuan_item TEXT DEFAULT NULL,
  p_kondisi TEXT DEFAULT 'baik',
  p_lokasi TEXT DEFAULT NULL,
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  IF NOT is_feature_enabled('logistics') THEN
    RAISE EXCEPTION 'logistics feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S4')) THEN
    RAISE EXCEPTION 'Unauthorized: hanya staf S-4 yang dapat menulis data logistik';
  END IF;

  INSERT INTO public.logistics_items (nama_item, kategori, jumlah, satuan_item, kondisi, lokasi, catatan)
  VALUES (
    p_nama_item,
    p_kategori,
    COALESCE(p_jumlah, 0),
    p_satuan_item,
    COALESCE(p_kondisi, 'baik')::public.logistics_condition,
    p_lokasi,
    p_catatan
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_logistics_status(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_status      TEXT,
  p_admin_note  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  IF NOT is_feature_enabled('logistics') THEN
    RAISE EXCEPTION 'logistics feature is disabled';
  END IF;
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid logistics status';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S4')) THEN
    RAISE EXCEPTION 'Unauthorized: hanya staf S-4 yang dapat memproses permintaan logistik';
  END IF;

  UPDATE public.logistics_requests
  SET status      = p_status,
      admin_note  = p_admin_note,
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_id;
END;
$$;

-- ------------------------------------------------------------
-- Discipline notes read: Guard/Provost must be allowed
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_discipline_notes(
  p_filter_user_id UUID DEFAULT NULL,
  p_satuan_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  jenis TEXT,
  isi TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  "user" JSON,
  creator JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.current_karyo_role_db();

  IF NOT (
    v_role = 'guard'
    OR v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S1'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: akses discipline notes ditolak';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    d.jenis,
    d.isi,
    d.created_by,
    d.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan)
      ELSE NULL
    END,
    CASE WHEN c.id IS NOT NULL
      THEN json_build_object('id', c.id, 'nama', c.nama)
      ELSE NULL
    END
  FROM public.discipline_notes d
  LEFT JOIN public.users u ON u.id = d.user_id
  LEFT JOIN public.users c ON c.id = d.created_by
  WHERE (p_filter_user_id IS NULL OR d.user_id = p_filter_user_id)
    AND (p_satuan_filter IS NULL OR u.satuan = p_satuan_filter)
  ORDER BY d.created_at DESC;
END;
$$;

NOTIFY pgrst, 'reload schema';
