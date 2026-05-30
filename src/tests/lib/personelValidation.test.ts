import { describe, expect, it } from 'vitest';
import { getFirstErrorMessage, validateRoleEditForm } from '@/features/shared/lib/validation/personelValidation';

describe('personelValidation helpers', () => {
  it('requires tingkat komando when role is komandan', () => {
    const errors = validateRoleEditForm({ role: 'komandan' });
    expect(errors).toHaveLength(1);
    expect(getFirstErrorMessage(errors)).toContain('Tingkat komando');
  });

  it('accepts komandan role with tingkat komando', () => {
    const errors = validateRoleEditForm({
      role: 'komandan',
      level_komando: 'PELETON',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts non-komandan roles without tingkat komando', () => {
    const errors = validateRoleEditForm({ role: 'admin' });
    expect(errors).toHaveLength(0);
  });
});
