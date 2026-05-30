import { useEffect, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface GPSLocation {
  id: string;
  userId: string;
  userName?: string;
  userNrp?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  eventType: 'check_in' | 'check_out' | 'gate_pass_submit';
  eventTime: string;
  relatedId?: string;
  relatedData?: Record<string, unknown>;
}

/**
 * Fetch all GPS tracking data dari attendance dan gate pass.
 * Menggabungkan check-in/check-out locations dengan gate pass submission locations.
 */
export function useGPSTracking() {
  const [locations, setLocations] = useState<GPSLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const results: GPSLocation[] = [];

      // Fetch attendance check-in locations
      const { data: attendances, error: attError } = await supabase
        .from('attendance')
        .select('id, user_id, check_in_latitude, check_in_longitude, check_in_accuracy, check_in, check_out_latitude, check_out_longitude, check_out_accuracy, check_out', { count: 'exact' })
        .not('check_in_latitude', 'is', null)
        .order('check_in', { ascending: false })
        .limit(500);

      if (attError) throw attError;

      if (attendances) {
        // Get user info for mapping
        const userIds = new Set(attendances.map(a => a.user_id));
        const { data: users } = await supabase
          .from('users')
          .select('id, nama, nrp')
          .in('id', Array.from(userIds));
        const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]));

        for (const att of attendances) {
          // Check-in location
          if (att.check_in_latitude && att.check_in_longitude) {
            results.push({
              id: `att_${att.id}_in`,
              userId: att.user_id,
              userName: userMap[att.user_id]?.nama,
              userNrp: userMap[att.user_id]?.nrp,
              latitude: att.check_in_latitude,
              longitude: att.check_in_longitude,
              accuracy: att.check_in_accuracy,
              eventType: 'check_in',
              eventTime: att.check_in || '',
              relatedId: att.id,
              relatedData: { type: 'attendance' },
            });
          }

          // Check-out location
          if (att.check_out_latitude && att.check_out_longitude) {
            results.push({
              id: `att_${att.id}_out`,
              userId: att.user_id,
              userName: userMap[att.user_id]?.nama,
              userNrp: userMap[att.user_id]?.nrp,
              latitude: att.check_out_latitude,
              longitude: att.check_out_longitude,
              accuracy: att.check_out_accuracy,
              eventType: 'check_out',
              eventTime: att.check_out || '',
              relatedId: att.id,
              relatedData: { type: 'attendance' },
            });
          }
        }
      }

      // Fetch gate pass submit locations
      const { data: gatePasses, error: gpError } = await supabase
        .from('gate_pass')
        .select('id, user_id, submit_latitude, submit_longitude, submit_accuracy, created_at', { count: 'exact' })
        .not('submit_latitude', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (gpError) throw gpError;

      if (gatePasses) {
        // Get user info
        const userIds = new Set(gatePasses.map(gp => gp.user_id));
        const { data: users } = await supabase
          .from('users')
          .select('id, nama, nrp')
          .in('id', Array.from(userIds));
        const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]));

        for (const gp of gatePasses) {
          if (gp.submit_latitude && gp.submit_longitude) {
            results.push({
              id: `gp_${gp.id}`,
              userId: gp.user_id,
              userName: userMap[gp.user_id]?.nama,
              userNrp: userMap[gp.user_id]?.nrp,
              latitude: gp.submit_latitude,
              longitude: gp.submit_longitude,
              accuracy: gp.submit_accuracy,
              eventType: 'gate_pass_submit',
              eventTime: gp.created_at,
              relatedId: gp.id,
              relatedData: { type: 'gate_pass' },
            });
          }
        }
      }

      // Sort by time descending
      results.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
      setLocations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat lokasi GPS');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  return { locations, isLoading, error, refetch: fetchLocations };
}
