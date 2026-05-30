import { supabase } from '../supabase';
import type { Attendance } from '../../types';
import type { GeoCoordinates } from '../geolocation';

export async function fetchAttendance(callerId: string, callerRole: string, userId: string, limit = 30): Promise<Attendance[]> {
  const { data, error } = await supabase.rpc('api_get_attendance', {
    p_user_id: callerId,
    p_role: callerRole,
    p_target_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as Attendance[]) ?? [];
}

export async function rpcCheckIn(userId: string, gps?: GeoCoordinates | null): Promise<void> {
  const { error } = await supabase.rpc('server_checkin', {
    p_user_id: userId,
    p_latitude: gps?.latitude ?? null,
    p_longitude: gps?.longitude ?? null,
    p_accuracy: gps?.accuracy ?? null,
  });
  if (error) throw error;
}

export async function rpcCheckOut(userId: string, gps?: GeoCoordinates | null): Promise<void> {
  const { error } = await supabase.rpc('server_checkout', {
    p_user_id: userId,
    p_latitude: gps?.latitude ?? null,
    p_longitude: gps?.longitude ?? null,
    p_accuracy: gps?.accuracy ?? null,
  });
  if (error) throw error;
}
