-- Enable RLS jika belum
ALTER TABLE gate_pass ENABLE ROW LEVEL SECURITY;

-- Guard hanya bisa SELECT gate_pass status 'approved' atau 'out'
DROP POLICY IF EXISTS "Guard dapat melihat gate pass scan" ON gate_pass;
CREATE POLICY "Guard dapat melihat gate pass scan" ON gate_pass
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = current_karyo_user_id() AND u.role = 'guard'
    )
    AND (status = 'approved' OR status = 'out')
  );

-- Guard hanya bisa UPDATE actual_keluar, actual_kembali, status
DROP POLICY IF EXISTS "Guard update status keluar/masuk" ON gate_pass;
CREATE POLICY "Guard update status keluar/masuk" ON gate_pass
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = current_karyo_user_id() AND u.role = 'guard'
    )
    AND (status = 'approved' OR status = 'out')
  )
  WITH CHECK (
    (status = 'out' OR status = 'returned' OR status = 'approved')
  );
