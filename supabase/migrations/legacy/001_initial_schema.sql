-- ============================================================
-- KARYO OS — Initial Schema Migration
-- ============================================================

-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nrp             TEXT NOT NULL UNIQUE,
  pin_hash        TEXT NOT NULL,
  nama            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'komandan', 'prajurit')),
  pangkat         TEXT,
  jabatan         TEXT,
  satuan          TEXT NOT NULL,
  foto_url        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_online       BOOLEAN NOT NULL DEFAULT FALSE,
  login_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul       TEXT NOT NULL,
  deskripsi   TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'in_progress', 'done', 'approved', 'rejected')),
  prioritas   INTEGER NOT NULL DEFAULT 2 CHECK (prioritas IN (1, 2, 3)),
  deadline    TIMESTAMPTZ,
  satuan      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASK REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  isi_laporan  TEXT NOT NULL,
  file_url     TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal     DATE NOT NULL,
  check_in    TIMESTAMPTZ,
  check_out   TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'hadir'
              CHECK (status IN ('hadir', 'izin', 'sakit', 'alpa', 'dinas_luar')),
  keterangan  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tanggal)
);

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jenis_izin      TEXT NOT NULL CHECK (jenis_izin IN ('cuti', 'sakit', 'dinas_luar')),
  tanggal_mulai   DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  alasan          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID REFERENCES public.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul          TEXT NOT NULL,
  isi            TEXT NOT NULL,
  target_role    TEXT[],
  target_satuan  TEXT,
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID REFERENCES public.users(id) ON DELETE SET NULL,
  to_user   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  isi       TEXT NOT NULL,
  is_read   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOGISTICS ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logistics_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_item   TEXT NOT NULL,
  kategori    TEXT,
  jumlah      INTEGER NOT NULL DEFAULT 0 CHECK (jumlah >= 0),
  satuan_item TEXT,
  kondisi     TEXT CHECK (kondisi IN ('baik', 'rusak_ringan', 'rusak_berat')),
  lokasi      TEXT,
  catatan     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id TEXT,
  detail      JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SHIFT SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shift_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal      DATE NOT NULL,
  shift_mulai  TIME NOT NULL,
  shift_selesai TIME NOT NULL,
  jenis_shift  TEXT CHECK (jenis_shift IN ('pagi', 'siang', 'malam', 'jaga')),
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        TEXT NOT NULL,
  kategori    TEXT,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  satuan      TEXT,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DISCIPLINE NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.discipline_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jenis      TEXT CHECK (jenis IN ('peringatan', 'penghargaan', 'catatan')),
  isi        TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_nrp ON public.users(nrp);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_satuan ON public.users(satuan);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_tanggal ON public.attendance(user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Verify PIN (hashed with bcrypt via pgcrypto)
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_nrp TEXT, p_pin TEXT)
RETURNS TABLE (user_id UUID) AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE nrp = p_nrp AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check if locked
  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
    RETURN;
  END IF;

  -- Verify PIN
  IF v_user.pin_hash = extensions.crypt(p_pin, v_user.pin_hash) THEN
    user_id := v_user.id;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment login attempts & lock if exceeded
CREATE OR REPLACE FUNCTION public.increment_login_attempts(p_nrp TEXT)
RETURNS VOID AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  UPDATE public.users
  SET login_attempts = login_attempts + 1,
      locked_until = CASE
        WHEN login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
        ELSE locked_until
      END
  WHERE nrp = p_nrp
  RETURNING login_attempts INTO v_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user with hashed PIN
CREATE OR REPLACE FUNCTION public.create_user_with_pin(
  p_nrp     TEXT,
  p_pin     TEXT,
  p_nama    TEXT,
  p_role    TEXT,
  p_satuan  TEXT,
  p_pangkat TEXT DEFAULT NULL,
  p_jabatan TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
  VALUES (
    p_nrp,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    p_nama,
    p_role,
    p_satuan,
    p_pangkat,
    p_jabatan
  )
  ON CONFLICT (nrp) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      nama = EXCLUDED.nama,
      role = EXCLUDED.role,
      satuan = EXCLUDED.satuan,
      pangkat = EXCLUDED.pangkat,
      jabatan = EXCLUDED.jabatan,
      updated_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset user PIN (admin only)
CREATE OR REPLACE FUNCTION public.reset_user_pin(p_user_id UUID, p_new_pin TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Change own PIN (requires old PIN)
CREATE OR REPLACE FUNCTION public.change_user_pin(
  p_user_id UUID,
  p_old_pin TEXT,
  p_new_pin TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_hash FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_hash != extensions.crypt(p_old_pin, v_hash) THEN RETURN FALSE; END IF;

  UPDATE public.users
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      updated_at = NOW()
  WHERE id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_logistics_updated_at ON public.logistics_items;
CREATE TRIGGER trg_logistics_updated_at
  BEFORE UPDATE ON public.logistics_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_notes ENABLE ROW LEVEL SECURITY;

-- ⚠ DEVELOPMENT-ONLY POLICIES (MUST be replaced before production)
-- KARYO OS uses its own PIN-based auth (not Supabase Auth JWT), so the
-- application server is responsible for authorisation logic. These permissive
-- anon policies are for local development only.
--
-- PRODUCTION HARDENING CHECKLIST:
-- 1. Switch to service-role key server-side and revoke direct anon table access.
-- 2. Replace these policies with role-specific restrictions, e.g.:
--      CREATE POLICY "users_own_row" ON public.users FOR SELECT TO anon
--        USING (id = current_setting('app.current_user_id')::uuid);
-- 3. Restrict audit_logs, discipline_notes, pin_hash column to admin only.
-- 4. Enable Supabase Realtime only for the tables that need it.
-- 5. Review each table's INSERT/UPDATE/DELETE policy individually.

DROP POLICY IF EXISTS "dev_anon_all_users" ON public.users;
CREATE POLICY "dev_anon_all_users" ON public.users FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_tasks" ON public.tasks;
CREATE POLICY "dev_anon_all_tasks" ON public.tasks FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_task_reports" ON public.task_reports;
CREATE POLICY "dev_anon_all_task_reports" ON public.task_reports FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_attendance" ON public.attendance;
CREATE POLICY "dev_anon_all_attendance" ON public.attendance FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_leave_requests" ON public.leave_requests;
CREATE POLICY "dev_anon_all_leave_requests" ON public.leave_requests FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_announcements" ON public.announcements;
CREATE POLICY "dev_anon_all_announcements" ON public.announcements FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_messages" ON public.messages;
CREATE POLICY "dev_anon_all_messages" ON public.messages FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_logistics_items" ON public.logistics_items;
CREATE POLICY "dev_anon_all_logistics_items" ON public.logistics_items FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_audit_logs" ON public.audit_logs;
CREATE POLICY "dev_anon_all_audit_logs" ON public.audit_logs FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_shift_schedules" ON public.shift_schedules;
CREATE POLICY "dev_anon_all_shift_schedules" ON public.shift_schedules FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_documents" ON public.documents;
CREATE POLICY "dev_anon_all_documents" ON public.documents FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "dev_anon_all_discipline_notes" ON public.discipline_notes;
CREATE POLICY "dev_anon_all_discipline_notes" ON public.discipline_notes FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- SEED DATA (optional — sample admin account)
-- PIN: 123456
-- ============================================================
-- INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat)
-- VALUES (
--   '1000001',
--   crypt('123456', gen_salt('bf', 10)),
--   'Admin Karyo',
--   'admin',
--   'Batalyon 1',
--   'Letnan Kolonel'
-- );
