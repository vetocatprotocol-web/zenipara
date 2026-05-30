import { supabase } from '../supabase';
import type { Task, TaskReport, TaskStatus } from '../../types';
import { ensureSessionContext } from './sessionContext';

export interface FetchTasksParams {
  callerId: string;
  callerRole: string;
  assignedTo?: string;
  assignedBy?: string;
  status?: TaskStatus;
  satuan?: string;
}

export async function fetchTasks(params: FetchTasksParams): Promise<Task[]> {
  await ensureSessionContext(params.callerId, params.callerRole);
  const { data, error } = await supabase.rpc('api_get_tasks', {
    p_user_id: params.callerId,
    p_role: params.callerRole,
    p_assigned_to: params.assignedTo ?? null,
    p_assigned_by: params.assignedBy ?? null,
    p_status: params.status ?? null,
    p_satuan: params.satuan ?? null,
  });
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export async function insertTask(callerId: string, callerRole: string, taskData: {
  judul: string;
  deskripsi?: string;
  assigned_to: string;
  assigned_by?: string;
  deadline?: string;
  prioritas: 1 | 2 | 3;
  satuan?: string;
}): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_insert_task', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_judul: taskData.judul,
    p_deskripsi: taskData.deskripsi ?? null,
    p_assigned_to: taskData.assigned_to,
    p_assigned_by: taskData.assigned_by ?? null,
    p_deadline: taskData.deadline ?? null,
    p_prioritas: taskData.prioritas,
    p_satuan: taskData.satuan ?? null,
  });
  if (error) throw error;
}

export async function patchTaskStatus(callerId: string, callerRole: string, taskId: string, status: TaskStatus): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_update_task_status', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_task_id: taskId,
    p_status: status,
  });
  if (error) throw error;
}

export async function insertTaskReport(callerId: string, callerRole: string, report: {
  task_id: string;
  user_id?: string;
  isi_laporan: string;
  file_url?: string;
}): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_insert_task_report', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_task_id: report.task_id,
    p_isi_laporan: report.isi_laporan,
    p_file_url: report.file_url ?? null,
  });
  if (error) throw error;
}

export async function fetchLatestTaskReport(callerId: string, callerRole: string, taskId: string): Promise<TaskReport | null> {
  await ensureSessionContext(callerId, callerRole);
  const { data, error } = await supabase.rpc('api_get_latest_task_report', {
    p_user_id: callerId,
    p_role: callerRole,
    p_task_id: taskId,
  });
  if (error) throw error;
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return (data[0] as TaskReport) ?? null;
}
