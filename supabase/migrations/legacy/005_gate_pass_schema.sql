DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'gate_pass_status'
  ) THEN
    CREATE TYPE gate_pass_status AS ENUM ('pending', 'approved', 'rejected', 'out', 'returned', 'overdue');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS gate_pass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keperluan text NOT NULL,
  tujuan varchar(255) NOT NULL,
  waktu_keluar timestamptz NOT NULL,
  waktu_kembali timestamptz NOT NULL,
  actual_keluar timestamptz,
  actual_kembali timestamptz,
  status gate_pass_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES users(id),
  qr_token text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gate_pass_user_id ON gate_pass(user_id);
CREATE INDEX IF NOT EXISTS idx_gate_pass_status ON gate_pass(status);
CREATE INDEX IF NOT EXISTS idx_gate_pass_qr_token ON gate_pass(qr_token);

-- Constraint: waktu_kembali > waktu_keluar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waktu_kembali_gt_waktu_keluar'
  ) THEN
    ALTER TABLE gate_pass
      ADD CONSTRAINT waktu_kembali_gt_waktu_keluar CHECK (waktu_kembali > waktu_keluar);
  END IF;
END $$;