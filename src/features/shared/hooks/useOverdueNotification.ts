import { useMemo } from 'react';
import { useGatePassStore } from '../store/gatePassStore';

/**
 * Returns gate passes that are currently overdue (status === 'overdue').
 *
 * The overdue status is computed client-side in the store's fetchGatePasses()
 * by comparing waktu_kembali with the current time for passes with status
 * 'checked_in'. Querying the database directly would always return an empty list
 * because 'overdue' is never persisted to the database.
 */
export function useOverdueNotification() {
  const gatePasses = useGatePassStore((s) => s.gatePasses);
  return useMemo(() => gatePasses.filter((gp) => gp.status === 'overdue'), [gatePasses]);
}
