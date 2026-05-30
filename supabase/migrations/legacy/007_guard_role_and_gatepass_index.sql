-- Add guard role to the users role constraint
DO $$
BEGIN
	ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
	ALTER TABLE public.users
		ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'komandan', 'prajurit', 'guard'));
END $$;

-- Index untuk gate_pass
CREATE UNIQUE INDEX IF NOT EXISTS idx_gate_pass_qr_token ON gate_pass(qr_token);
CREATE INDEX IF NOT EXISTS idx_gate_pass_status ON gate_pass(status);
