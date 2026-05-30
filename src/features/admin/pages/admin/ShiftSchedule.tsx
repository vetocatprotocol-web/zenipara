import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, List } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Input from '../../components/common/Input';
import UserSearchSelect from '../../components/common/UserSearchSelect';
import PageHeader from '../../components/ui/PageHeader';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import type { ShiftSchedule } from '../../types';
import { canWrite } from '../../lib/rolePermissions';

const SHIFT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pagi:  { bg: 'bg-accent-gold/20',  text: 'text-accent-gold',  label: 'Pagi'   },
  siang: { bg: 'bg-success/20',       text: 'text-success',      label: 'Siang'  },
  malam: { bg: 'bg-blue-500/20',      text: 'text-blue-400',     label: 'Malam'  },
  jaga:  { bg: 'bg-accent-red/20',   text: 'text-accent-red',   label: 'Jaga'   },
};

const SHIFT_PRESET_TIME: Record<'pagi' | 'siang' | 'malam' | 'jaga', { start: string; end: string } | null> = {
  pagi: { start: '07:00', end: '15:00' },
  siang: { start: '15:00', end: '23:00' },
  malam: { start: '23:00', end: '07:00' },
  jaga: null,
};

/** Zero-pad a number to 2 digits */
const pad = (n: number) => String(n).padStart(2, '0');

/** Returns YYYY-MM-DD for a given Date */
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Day-of-week header labels (Mon-Sun) */
const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const timeToMinutes = (timeValue: string): number => {
  const [hh = '0', mm = '0'] = timeValue.split(':');
  return Number(hh) * 60 + Number(mm);
};

const splitTimeRange = (start: string, end: string): Array<[number, number]> => {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin === endMin) return [];
  if (endMin > startMin) return [[startMin, endMin]];
  return [[startMin, 1440], [0, endMin]];
};

const hasTimeOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean => {
  const rangesA = splitTimeRange(startA, endA);
  const rangesB = splitTimeRange(startB, endB);

  for (const [aStart, aEnd] of rangesA) {
    for (const [bStart, bEnd] of rangesB) {
      if (aStart < bEnd && bStart < aEnd) return true;
    }
  }

  return false;
};

export default function ShiftSchedule() {
  const { showNotification } = useUIStore();
  const { user } = useAuthStore();
  const canWriteShifts = canWrite(user, 'shifts');

  // View mode: 'list' (day list) | 'calendar' (monthly grid)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Shared state
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // List view: selected single day
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(toISO(today));

  // Calendar view: displayed month (YYYY-MM)
  const [calendarMonth, setCalendarMonth] = useState(`${today.getFullYear()}-${pad(today.getMonth() + 1)}`);
  // All schedules for the displayed month (calendar view)
  const [monthSchedules, setMonthSchedules] = useState<ShiftSchedule[]>([]);
  const [isMonthLoading, setIsMonthLoading] = useState(false);

  const [form, setForm] = useState({
    user_id: '',
    tanggal: toISO(today),
    shift_mulai: '07:00',
    shift_selesai: '15:00',
    jenis_shift: 'pagi' as 'pagi' | 'siang' | 'malam' | 'jaga',
  });

  // ── List view fetch (by day) ──────────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.rpc('api_get_shift_schedules', {
      p_date: selectedDate,
    });
    setSchedules((data as ShiftSchedule[]) ?? []);
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    if (viewMode === 'list') void fetchSchedules();
  }, [viewMode, fetchSchedules]);

  // ── Calendar view fetch (full month) ─────────────────────────────────────
  const fetchMonthSchedules = useCallback(async () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = `${calendarMonth}-01`;
    const lastDay = toISO(new Date(year, month, 0)); // day 0 of next month = last of current
    setIsMonthLoading(true);
    const { data } = await supabase.rpc('api_get_shift_schedules', {
      p_date_from: firstDay,
      p_date_to: lastDay,
    });
    setMonthSchedules((data as ShiftSchedule[]) ?? []);
    setIsMonthLoading(false);
  }, [calendarMonth]);

  useEffect(() => {
    if (viewMode === 'calendar') void fetchMonthSchedules();
  }, [viewMode, fetchMonthSchedules]);

  // ── Build calendar grid ───────────────────────────────────────────────────
  const buildCalendarCells = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    // Mon=0 … Sun=6  (JS getDay: 0=Sun)
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const cells: (string | null)[] = Array<null>(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${calendarMonth}-${pad(d)}`);
    }
    // Pad to full rows of 7
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const calendarCells = buildCalendarCells();
  const monthSchedulesByDay = monthSchedules.reduce<Record<string, ShiftSchedule[]>>((acc, s) => {
    const d = s.tanggal;
    acc[d] = acc[d] ?? [];
    acc[d].push(s);
    return acc;
  }, {});

  const scheduleSourceByDate = useMemo(() => {
    if (viewMode === 'calendar') return monthSchedulesByDay;
    return { [selectedDate]: schedules };
  }, [monthSchedulesByDay, schedules, selectedDate, viewMode]);

  const formDateSchedules = scheduleSourceByDate[form.tanggal] ?? [];
  const userShiftOnFormDate = formDateSchedules.filter((schedule) => schedule.user_id === form.user_id);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.user_id) { showNotification('Pilih personel', 'error'); return; }
    if (!form.tanggal) { showNotification('Tanggal wajib diisi', 'error'); return; }
    if (form.shift_mulai === form.shift_selesai) {
      showNotification('Jam mulai dan selesai tidak boleh sama', 'error');
      return;
    }
    if (!user?.id || !user.role) { showNotification('Sesi tidak valid', 'error'); return; }

    // Validasi bentrok jadwal untuk personel pada tanggal yang sama.
    const { data: daySchedulesData, error: daySchedulesError } = await supabase.rpc('api_get_shift_schedules', {
      p_date: form.tanggal,
    });
    if (daySchedulesError) {
      showNotification('Gagal memvalidasi jadwal pada tanggal terpilih', 'error');
      return;
    }

    const daySchedules = (daySchedulesData as ShiftSchedule[]) ?? [];
    const hasConflict = daySchedules
      .filter((schedule) => schedule.user_id === form.user_id)
      .some((schedule) => hasTimeOverlap(form.shift_mulai, form.shift_selesai, schedule.shift_mulai, schedule.shift_selesai));

    if (hasConflict) {
      showNotification('Personel sudah memiliki shift yang bentrok pada tanggal tersebut', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('api_insert_shift_schedule', {
        p_caller_id: user.id,
        p_caller_role: user.role,
        p_user_id: form.user_id,
        p_tanggal: form.tanggal,
        p_shift_mulai: form.shift_mulai,
        p_shift_selesai: form.shift_selesai,
        p_jenis_shift: form.jenis_shift,
      });
      if (error) throw error;
      showNotification('Jadwal shift ditambahkan', 'success');
      setShowCreate(false);
      if (viewMode === 'list') await fetchSchedules();
      else await fetchMonthSchedules();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    if (!user?.id || !user.role) { showNotification('Sesi tidak valid', 'error'); return; }
    setIsDeleting(true);
    const { error } = await supabase.rpc('api_delete_shift_schedule', {
      p_caller_id: user.id,
      p_caller_role: user.role,
      p_id: confirmDeleteId,
    });
    if (error) { showNotification('Gagal menghapus', 'error'); }
    else {
      showNotification('Jadwal dihapus', 'success');
      if (viewMode === 'list') await fetchSchedules();
      else await fetchMonthSchedules();
    }
    setConfirmDeleteId(null);
    setIsDeleting(false);
  };

  const prevMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setCalendarMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const nextMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setCalendarMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  const monthLabel = new Date(`${calendarMonth}-15`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const handleShiftTypeChange = (jenisShift: 'pagi' | 'siang' | 'malam' | 'jaga') => {
    const preset = SHIFT_PRESET_TIME[jenisShift];
    if (!preset) {
      setForm({ ...form, jenis_shift: jenisShift });
      return;
    }

    setForm({
      ...form,
      jenis_shift: jenisShift,
      shift_mulai: preset.start,
      shift_selesai: preset.end,
    });
  };

  return (
    <DashboardLayout title="Jadwal Shift">
      <div className="space-y-5">
        <PageHeader
          title="Kalender Jadwal Shift"
          subtitle="Atur dan pantau pembagian shift harian maupun bulanan seluruh personel satuan."
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View toggle */}
          <div className="seg-control">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`seg-btn ${viewMode === 'list' ? 'seg-btn--active' : ''}`}
            >
              <List size={13} aria-hidden="true" /> Harian
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`seg-btn ${viewMode === 'calendar' ? 'seg-btn--active' : ''}`}
            >
              <CalendarDays size={13} aria-hidden="true" /> Bulanan
            </button>
          </div>

          {viewMode === 'list' && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-text-muted">Tanggal:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-control"
                />
              </div>
              {canWriteShifts && (
                <Button onClick={() => { setForm({ ...form, tanggal: selectedDate }); setShowCreate(true); }}>
                  + Tambah Shift
                </Button>
              )}
            </>
          )}

          {viewMode === 'calendar' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-lg border border-surface/70 bg-bg-card px-3 py-1.5 text-sm text-text-muted hover:text-text-primary"
                  aria-label="Bulan sebelumnya"
                >
                  ‹
                </button>
                <span className="min-w-[130px] text-center text-sm font-semibold text-text-primary capitalize">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-lg border border-surface/70 bg-bg-card px-3 py-1.5 text-sm text-text-muted hover:text-text-primary"
                  aria-label="Bulan berikutnya"
                >
                  ›
                </button>
              </div>
              <Button onClick={() => { setForm({ ...form, tanggal: toISO(today) }); setShowCreate(true); }}>
                + Tambah Shift
              </Button>
            </>
          )}
        </div>

        {/* ── List View ── */}
        {viewMode === 'list' && (
          <Table<ShiftSchedule>
            columns={[
              {
                key: 'user',
                header: 'Personel',
                render: (s) => (
                  <div>
                    <p className="font-medium text-text-primary">{s.user?.nama ?? '—'}</p>
                    <p className="font-mono text-xs text-text-muted">{s.user?.nrp}</p>
                  </div>
                ),
              },
              { key: 'satuan', header: 'Satuan', render: (s) => s.user?.satuan ?? '—' },
              {
                key: 'jenis_shift',
                header: 'Jenis',
                render: (s) => {
                  const c = SHIFT_COLORS[s.jenis_shift ?? ''] ?? { text: 'text-text-muted' };
                  return (
                    <span className={`font-medium capitalize ${c.text}`}>
                      {SHIFT_COLORS[s.jenis_shift ?? '']?.label ?? s.jenis_shift ?? '—'}
                    </span>
                  );
                },
              },
              {
                key: 'shift_mulai',
                header: 'Waktu',
                render: (s) => `${s.shift_mulai} — ${s.shift_selesai}`,
              },
              {
                key: 'actions',
                header: 'Aksi',
                render: (s) => canWriteShifts ? (
                  <Button size="sm" variant="danger" onClick={() => handleDelete(s.id)}>
                    Hapus
                  </Button>
                ) : null,
              },
            ]}
            data={schedules}
            keyExtractor={(s) => s.id}
            isLoading={isLoading}
            emptyMessage={`Tidak ada jadwal untuk ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
          />
        )}

        {/* ── Calendar View ── */}
        {viewMode === 'calendar' && (
          <div className="app-card overflow-hidden">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-surface/70 bg-surface/30">
              {DAY_LABELS.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {d}
                </div>
              ))}
            </div>

            {isMonthLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-text-muted">
                Memuat kalender…
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x divide-y divide-surface/50">
                {calendarCells.map((dateStr, idx) => {
                  if (!dateStr) {
                    return <div key={`empty-${idx}`} className="min-h-[90px] bg-surface/10 p-1" />;
                  }
                  const dayNum = Number(dateStr.slice(-2));
                  const isToday = dateStr === toISO(today);
                  const dayShifts = monthSchedulesByDay[dateStr] ?? [];

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[90px] cursor-pointer p-1.5 transition-colors hover:bg-surface/30 ${
                        isToday ? 'bg-primary/5' : ''
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setViewMode('list');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedDate(dateStr);
                          setViewMode('list');
                        }
                      }}
                      aria-label={`Lihat jadwal tanggal ${new Date(`${dateStr}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
                    >
                      {/* Date number */}
                      <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday ? 'bg-primary text-white' : 'text-text-muted'
                      }`}>
                        {dayNum}
                      </div>

                      {/* Shift badges (max 3 visible) */}
                      <div className="space-y-0.5">
                        {dayShifts.slice(0, 3).map((s) => {
                          const c = SHIFT_COLORS[s.jenis_shift ?? ''] ?? { bg: 'bg-surface/40', text: 'text-text-muted', label: '?' };
                          return (
                            <div
                              key={s.id}
                              title={`${s.user?.nama ?? '?'} — ${c.label} ${s.shift_mulai}–${s.shift_selesai}`}
                              className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${c.bg} ${c.text}`}
                            >
                              {s.user?.nama ?? '?'}
                            </div>
                          );
                        })}
                        {dayShifts.length > 3 && (
                          <div className="text-[10px] text-text-muted pl-1">
                            +{dayShifts.length - 3} lainnya
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 border-t border-surface/70 px-4 py-3">
              {Object.entries(SHIFT_COLORS).map(([key, c]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded ${c.bg} ${c.text} inline-block`} />
                  <span className="text-xs text-text-muted">{c.label}</span>
                </div>
              ))}
              <span className="text-xs text-text-muted ml-auto">
                Total shift bulan ini: {monthSchedules.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tambah Jadwal Shift"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} isLoading={isSaving}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary">Personel *</label>
            <UserSearchSelect
              className="mt-1 space-y-2"
              value={form.user_id}
              onChange={(userId) => setForm({ ...form, user_id: userId })}
              isActive
              emptyLabel="Pilih personel..."
              placeholder="Cari personel (nama/NRP)..."
            />
          </div>
          <Input
            label="Tanggal"
            type="date"
            value={form.tanggal}
            onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jam Mulai"
              type="time"
              value={form.shift_mulai}
              onChange={(e) => setForm({ ...form, shift_mulai: e.target.value })}
            />
            <Input
              label="Jam Selesai"
              type="time"
              value={form.shift_selesai}
              onChange={(e) => setForm({ ...form, shift_selesai: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary">Jenis Shift</label>
            <select
              className="form-control mt-1"
              value={form.jenis_shift}
              onChange={(e) => handleShiftTypeChange(e.target.value as typeof form.jenis_shift)}
            >
              <option value="pagi">Pagi (07:00–15:00)</option>
              <option value="siang">Siang (15:00–23:00)</option>
              <option value="malam">Malam (23:00–07:00)</option>
              <option value="jaga">Jaga / Piket</option>
            </select>
            <p className="mt-1 text-xs text-text-muted">
              Memilih jenis shift akan mengisi jam otomatis (kecuali shift jaga/piket).
            </p>
          </div>

          {form.user_id && userShiftOnFormDate.length > 0 && (
            <div className="rounded-xl border border-accent-red/20 bg-accent-red/5 px-3 py-2 text-xs text-accent-red">
              Personel ini sudah memiliki {userShiftOnFormDate.length} jadwal pada tanggal yang sama. Pastikan jam tidak bentrok.
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => { if (!isDeleting) setConfirmDeleteId(null); }}
        onConfirm={() => { void handleConfirmDelete(); }}
        title="Hapus Jadwal Shift"
        message="Jadwal shift ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        isConfirming={isDeleting}
      />
    </DashboardLayout>
  );
}
