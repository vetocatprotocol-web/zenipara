import { supabase } from '../supabase';
import type { AttendanceStatus, TaskStatus } from '../../types';

export interface TaskStatusCount {
  status: TaskStatus;
  count: number;
}

export interface AttendanceStatusCount {
  status: AttendanceStatus;
  count: number;
}

export interface PersonnelRoleCount {
  role: string;
  count: number;
}

export interface DailyAttendanceRate {
  date: string;
  hadir: number;
  total: number;
}

export interface WeeklyTaskActivity {
  week: string;
  created: number;
  completed: number;
}

export interface AnalyticsSnapshot {
  taskStatusCounts: TaskStatusCount[];
  attendanceStatusCounts: AttendanceStatusCount[];
  personnelRoleCounts: PersonnelRoleCount[];
  dailyAttendanceRates: DailyAttendanceRate[];
  weeklyTaskActivity: WeeklyTaskActivity[];
  totalGatePassThisMonth: number;
  overdueGatePassThisMonth: number;
  topActiveUsers: { nama: string; nrp: string; taskCount: number }[];
}

/** Derive daily attendance rate from raw records (last 14 days) */
function computeDailyAttendanceRates(
  rows: { tanggal: string; status: string }[],
  days: number,
): DailyAttendanceRate[] {
  const map = new Map<string, { hadir: number; total: number }>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    map.set(key, { hadir: 0, total: 0 });
  }
  for (const row of rows) {
    const bucket = map.get(row.tanggal);
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === 'hadir') bucket.hadir += 1;
  }
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
}

export async function fetchAnalyticsSnapshot(satuan?: string | null): Promise<AnalyticsSnapshot> {
  const today = new Date();
  const day14Ago = new Date(today);
  day14Ago.setDate(today.getDate() - 13);
  const day30Ago = new Date(today);
  day30Ago.setDate(today.getDate() - 29);

  const todayStr = today.toISOString().split('T')[0];
  const day14Ago8601 = day14Ago.toISOString().split('T')[0];
  const day30Ago8601 = day30Ago.toISOString().split('T')[0];

  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  let attendanceQuery = supabase
    .from('attendance')
    .select('tanggal, status')
    .gte('tanggal', day14Ago8601)
    .lte('tanggal', todayStr);

  let usersQuery = supabase.from('users').select('role').eq('is_active', true);

  // Filter by satuan when provided (via user join)
  if (satuan) {
    attendanceQuery = attendanceQuery.eq('satuan', satuan);
    usersQuery = usersQuery.eq('satuan', satuan);
  }

  const [tasksRes, attendanceRes, usersRes, gatePassRes, gatePassOverdueRes] = await Promise.all([
    supabase.from('tasks').select('status').not('status', 'is', null),
    attendanceQuery,
    usersQuery,
    supabase
      .from('gate_pass')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', firstOfMonth),
    supabase
      .from('gate_pass')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue')
      .gte('created_at', firstOfMonth),
  ]);

  // Task status distribution
  const taskStatusMap = new Map<string, number>();
  for (const row of (tasksRes.data ?? []) as { status: string }[]) {
    taskStatusMap.set(row.status, (taskStatusMap.get(row.status) ?? 0) + 1);
  }
  const taskStatusCounts: TaskStatusCount[] = Array.from(taskStatusMap.entries()).map(
    ([status, count]) => ({ status: status as TaskStatus, count }),
  );

  // Attendance status distribution
  const attendanceStatusMap = new Map<string, number>();
  for (const row of (attendanceRes.data ?? []) as { tanggal: string; status: string }[]) {
    attendanceStatusMap.set(row.status, (attendanceStatusMap.get(row.status) ?? 0) + 1);
  }
  const attendanceStatusCounts: AttendanceStatusCount[] = Array.from(
    attendanceStatusMap.entries(),
  ).map(([status, count]) => ({ status: status as AttendanceStatus, count }));

  // Daily attendance rate (last 14 days)
  const dailyAttendanceRates = computeDailyAttendanceRates(
    (attendanceRes.data ?? []) as { tanggal: string; status: string }[],
    14,
  );

  // Personnel role distribution
  const roleMap = new Map<string, number>();
  for (const row of (usersRes.data ?? []) as { role: string }[]) {
    roleMap.set(row.role, (roleMap.get(row.role) ?? 0) + 1);
  }
  const personnelRoleCounts: PersonnelRoleCount[] = Array.from(roleMap.entries()).map(
    ([role, count]) => ({ role, count }),
  );

  // Weekly task activity (last 4 weeks) — derived from a range query
  const week4Ago = new Date(today);
  week4Ago.setDate(today.getDate() - 27);
  const week4AgoStr = week4Ago.toISOString();

  const weeklyTasksRes = await supabase
    .from('tasks')
    .select('created_at, status')
    .gte('created_at', week4AgoStr);

  const weeklyMap = new Map<string, { created: number; completed: number }>();
  const weekLabels: string[] = [];
  for (let w = 3; w >= 0; w--) {
    const wStart = new Date(today);
    wStart.setDate(today.getDate() - w * 7 - 6);
    const label = wStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    weekLabels.push(label);
    weeklyMap.set(label, { created: 0, completed: 0 });
  }

  for (const task of (weeklyTasksRes.data ?? []) as { created_at: string; status: string }[]) {
    const ts = new Date(task.created_at);
    const diffDays = Math.floor((today.getTime() - ts.getTime()) / 86400000);
    const weekIndex = 3 - Math.min(3, Math.floor(diffDays / 7));
    const label = weekLabels[weekIndex];
    if (!label) continue;
    const bucket = weeklyMap.get(label)!;
    bucket.created += 1;
    if (task.status === 'approved' || task.status === 'done') bucket.completed += 1;
  }

  const weeklyTaskActivity: WeeklyTaskActivity[] = weekLabels.map((week) => ({
    week,
    ...weeklyMap.get(week)!,
  }));

  // Top 5 active users by task count (last 30 days)
  const activeUsersRes = await supabase
    .from('tasks')
    .select('assigned_to, users!tasks_assigned_to_fkey(nama, nrp)')
    .not('assigned_to', 'is', null)
    .gte('created_at', day30Ago8601 + 'T00:00:00Z')
    .limit(200);

  type TaskUserRow = { assigned_to: string; users: { nama: string; nrp: string } | { nama: string; nrp: string }[] | null };
  const userTaskMap = new Map<string, { nama: string; nrp: string; taskCount: number }>();
  for (const rawRow of (activeUsersRes.data ?? [])) {
    const row = rawRow as TaskUserRow;
    if (!row.assigned_to || !row.users) continue;
    const userInfo = Array.isArray(row.users) ? row.users[0] : row.users;
    if (!userInfo) continue;
    const existing = userTaskMap.get(row.assigned_to);
    if (existing) {
      existing.taskCount += 1;
    } else {
      userTaskMap.set(row.assigned_to, {
        nama: userInfo.nama,
        nrp: userInfo.nrp,
        taskCount: 1,
      });
    }
  }
  const topActiveUsers = Array.from(userTaskMap.values())
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, 5);

  return {
    taskStatusCounts,
    attendanceStatusCounts,
    personnelRoleCounts,
    dailyAttendanceRates,
    weeklyTaskActivity,
    totalGatePassThisMonth: gatePassRes.count ?? 0,
    overdueGatePassThisMonth: gatePassOverdueRes.count ?? 0,
    topActiveUsers,
  };
}
