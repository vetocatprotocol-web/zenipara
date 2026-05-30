-- ============================================================
-- KARYO OS — Phase 2 foundation: Multi-Satuan
-- Non-breaking evolution: keep legacy text column `users.satuan`
-- while introducing normalized tenant master `satuans` + `satuan_id`.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) Master table for tenant units
-- ============================================================
CREATE TABLE IF NOT EXISTS public.satuans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        TEXT NOT NULL UNIQUE,
  kode_satuan TEXT NOT NULL UNIQUE,
  tingkat     TEXT,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tingkat IS NULL OR tingkat IN ('battalion', 'company', 'squad', 'detachment'))
);

CREATE INDEX IF NOT EXISTS idx_satuans_is_active ON public.satuans(is_active);
CREATE INDEX IF NOT EXISTS idx_satuans_nama ON public.satuans(nama);

DROP TRIGGER IF EXISTS update_satuans_updated_at ON public.satuans;
CREATE TRIGGER update_satuans_updated_at
  BEFORE UPDATE ON public.satuans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.satuans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "satuans_read_authenticated" ON public.satuans;
CREATE POLICY "satuans_read_authenticated"
  ON public.satuans FOR SELECT TO anon
  USING (public.current_karyo_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "satuans_admin_all" ON public.satuans;
CREATE POLICY "satuans_admin_all"
  ON public.satuans FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

-- ============================================================
-- 2) Add normalized tenant key columns (nullable for compatibility)
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.discipline_notes ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.logistics_requests ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;
ALTER TABLE public.gate_pass ADD COLUMN IF NOT EXISTS satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_satuan_id ON public.users(satuan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_satuan_id ON public.tasks(satuan_id);
CREATE INDEX IF NOT EXISTS idx_attendance_satuan_id ON public.attendance(satuan_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_satuan_id ON public.leave_requests(satuan_id);
CREATE INDEX IF NOT EXISTS idx_announcements_satuan_id ON public.announcements(satuan_id);
CREATE INDEX IF NOT EXISTS idx_messages_satuan_id ON public.messages(satuan_id);
CREATE INDEX IF NOT EXISTS idx_documents_satuan_id ON public.documents(satuan_id);
CREATE INDEX IF NOT EXISTS idx_discipline_notes_satuan_id ON public.discipline_notes(satuan_id);
CREATE INDEX IF NOT EXISTS idx_logistics_requests_satuan_id ON public.logistics_requests(satuan_id);
CREATE INDEX IF NOT EXISTS idx_gate_pass_satuan_id ON public.gate_pass(satuan_id);

-- ============================================================
-- 3) Backfill master table and users.satuan_id from legacy users.satuan
-- ============================================================
WITH distinct_satuan AS (
  SELECT DISTINCT BTRIM(u.satuan) AS nama
  FROM public.users u
  WHERE u.satuan IS NOT NULL AND BTRIM(u.satuan) <> ''
), normalized AS (
  SELECT
    nama,
    regexp_replace(lower(nama), '[^a-z0-9]+', '-', 'g') AS base_code,
    row_number() OVER (
      PARTITION BY regexp_replace(lower(nama), '[^a-z0-9]+', '-', 'g')
      ORDER BY nama
    ) AS seq
  FROM distinct_satuan
)
INSERT INTO public.satuans (nama, kode_satuan)
SELECT
  n.nama,
  CASE
    WHEN n.base_code = '' THEN 'satuan'
    WHEN n.seq = 1 THEN n.base_code
    ELSE n.base_code || '-' || n.seq::TEXT
  END AS kode_satuan
FROM normalized n
ON CONFLICT (nama) DO NOTHING;

UPDATE public.users u
SET satuan_id = s.id
FROM public.satuans s
WHERE u.satuan_id IS NULL
  AND u.satuan IS NOT NULL
  AND BTRIM(u.satuan) <> ''
  AND s.nama = BTRIM(u.satuan);

-- ============================================================
-- 4) Keep legacy/new columns in sync during transition window
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_user_satuan_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_satuan_id UUID;
  v_satuan_nama TEXT;
BEGIN
  IF NEW.satuan IS NOT NULL THEN
    NEW.satuan := BTRIM(NEW.satuan);
  END IF;

  -- If satuan text is provided without id, resolve/create id.
  IF NEW.satuan_id IS NULL AND NEW.satuan IS NOT NULL AND NEW.satuan <> '' THEN
    SELECT id INTO v_satuan_id FROM public.satuans WHERE nama = NEW.satuan;

    IF v_satuan_id IS NULL THEN
      INSERT INTO public.satuans (nama, kode_satuan)
      VALUES (
        NEW.satuan,
        COALESCE(NULLIF(regexp_replace(lower(NEW.satuan), '[^a-z0-9]+', '-', 'g'), ''), 'satuan')
      )
      ON CONFLICT (nama) DO UPDATE SET updated_at = NOW()
      RETURNING id INTO v_satuan_id;
    END IF;

    NEW.satuan_id := v_satuan_id;
  END IF;

  -- If id exists, canonicalize text from master table.
  IF NEW.satuan_id IS NOT NULL THEN
    SELECT nama INTO v_satuan_nama FROM public.satuans WHERE id = NEW.satuan_id;
    IF v_satuan_nama IS NOT NULL THEN
      NEW.satuan := v_satuan_nama;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_satuan_fields ON public.users;
CREATE TRIGGER trg_sync_user_satuan_fields
  BEFORE INSERT OR UPDATE OF satuan, satuan_id
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_satuan_fields();

COMMIT;
