import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { CardListSkeleton } from '../../components/common/Skeleton';
import { useUIStore } from '../../store/uiStore';
import { useKegiatan } from '../../hooks/useKegiatan';
import { ICONS } from '../../icons';
import type { Kegiatan, KegiatanJenis, RsvpStatus } from '../../types';

const JENIS_OPTIONS: { value: KegiatanJenis; label: string }[] = [
  { value: 'latihan',    label: 'Latihan' },
  { value: 'upacara',   label: 'Upacara' },
  { value: 'inspeksi',  label: 'Inspeksi' },
  { value: 'perjalanan',label: 'Perjalanan Dinas' },
  { value: 'rapat',     label: 'Rapat' },
  { value: 'lainnya',   label: 'Lainnya' },
];

const JENIS_BADGE: Record<KegiatanJenis, string> = {
  latihan:    'bg-green-500/15 text-green-400 border border-green-500/30',
  upacara:    'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  inspeksi:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  perjalanan: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  rapat:      'bg-slate-500/15 text-slate-300 border border-slate-500/30',
  lainnya:    'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30',
};

const RSVP_LABEL: Record<RsvpStatus, string> = {
  hadir:        'Saya Hadir',
  tidak_hadir:  'Tidak Hadir',
  belum:        'Belum Konfirmasi',
};

const RSVP_STYLE: Record<RsvpStatus, string> = {
  hadir:        'bg-green-500/15 text-green-400 border border-green-500/30',
  tidak_hadir:  'bg-red-500/15 text-red-400 border border-red-500/30',
  belum:        'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30',
};

function formatRange(mulai: string, selesai: string) {
  const m = new Date(mulai);
  const s = new Date(selesai);
  if (m.toDateString() === s.toDateString()) {
    return `${m.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · ${m.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}–${s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return `${m.toLocaleDateString('id-ID', opts)} – ${s.toLocaleDateString('id-ID', opts)}`;
}

export default function PrajuritKegiatanPage() {
  const { showNotification } = useUIStore();
  const { kegiatan, isLoading, respondRsvp } = useKegiatan();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const handleRsvp = async (k: Kegiatan, status: RsvpStatus) => {
    if (respondingId) return;
    setRespondingId(k.id);
    try {
      await respondRsvp(k.id, status);
      showNotification(
        status === 'hadir' ? 'Dikonfirmasi hadir' : status === 'tidak_hadir' ? 'Dikonfirmasi tidak hadir' : 'RSVP diperbarui',
        'success',
      );
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan RSVP', 'error');
    } finally {
      setRespondingId(null);
    }
  };

  const upcoming = kegiatan.filter((k) => new Date(k.tanggal_selesai) >= new Date());
  const past = kegiatan.filter((k) => new Date(k.tanggal_selesai) < new Date());

  const KegiatanCard = ({ k }: { k: Kegiatan }) => {
    const rsvp = (k.my_rsvp ?? 'belum') as RsvpStatus;
    const isUpcoming = new Date(k.tanggal_selesai) >= new Date();
    return (
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${JENIS_BADGE[k.jenis]}`}>
                {JENIS_OPTIONS.find((o) => o.value === k.jenis)?.label ?? k.jenis}
              </span>
              {k.is_wajib && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-medium">Wajib</span>
              )}
            </div>
            <p className="font-semibold text-text-primary text-sm">{k.judul}</p>
            <p className="text-xs text-text-muted mt-0.5">{formatRange(k.tanggal_mulai, k.tanggal_selesai)}</p>
            {k.lokasi && (
              <p className="inline-flex items-center gap-1 text-xs text-text-muted">
                <ICONS.MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {k.lokasi}
              </p>
            )}
            {k.deskripsi && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{k.deskripsi}</p>}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${RSVP_STYLE[rsvp]}`}>
            {RSVP_LABEL[rsvp]}
          </span>
        </div>

        {isUpcoming && (
          <div className="flex gap-2 border-t border-white/5 pt-2">
            <Button
              size="sm"
              variant={rsvp === 'hadir' ? 'primary' : 'ghost'}
              className="flex-1"
              isLoading={respondingId === k.id}
              onClick={() => { void handleRsvp(k, 'hadir'); }}
            >
              Hadir
            </Button>
            <Button
              size="sm"
              variant={rsvp === 'tidak_hadir' ? 'danger' : 'ghost'}
              className="flex-1"
              isLoading={respondingId === k.id}
              onClick={() => { void handleRsvp(k, 'tidak_hadir'); }}
            >
              Tidak Hadir
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout title="Kalender Kegiatan">
      <PageHeader
        title="Kalender Kegiatan"
        subtitle="Jadwal dan konfirmasi kehadiran kegiatan satuan"
      />

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : kegiatan.length === 0 ? (
        <EmptyState title="Belum ada kegiatan" description="Komandan/admin belum menambahkan kegiatan." />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Akan Datang</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {upcoming.map((k) => <KegiatanCard key={k.id} k={k} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Sudah Berlalu</h3>
              <div className="grid gap-3 sm:grid-cols-2 opacity-60">
                {past.map((k) => <KegiatanCard key={k.id} k={k} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
