import { useCallback, useEffect, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import type { DisciplineNote } from '../../types';
import { AlertTriangle, Award, FileText } from 'lucide-react';

const JENIS_BADGE: Record<string, 'error' | 'success' | 'neutral'> = {
  peringatan: 'error',
  penghargaan: 'success',
  catatan: 'neutral',
};

const JENIS_ICON: Record<string, React.ReactNode> = {
  peringatan: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
  penghargaan: <Award className="h-3.5 w-3.5" aria-hidden="true" />,
  catatan: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
};

export default function GuardDisciplineNotes() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const [notes, setNotes] = useState<DisciplineNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchRaw, setSearchRaw] = useState('');
  const [filterJenis, setFilterJenis] = useState<'all' | 'peringatan' | 'penghargaan' | 'catatan'>('all');
  const search = useDebounce(searchRaw, 300);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('api_get_discipline_notes', {
        p_filter_user_id: null,
        p_satuan_filter: user?.satuan ?? null,
      });
      if (error) throw error;
      setNotes((data as DisciplineNote[]) ?? []);
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Gagal memuat catatan disiplin',
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.satuan, showNotification]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  const filtered = notes.filter((n) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (n.user?.nama?.toLowerCase().includes(q) ?? false) ||
      (n.user?.nrp?.includes(search) ?? false) ||
      n.isi.toLowerCase().includes(q);
    const matchJenis = filterJenis === 'all' || n.jenis === filterJenis;
    return matchSearch && matchJenis;
  });

  const peringatanCount = notes.filter((n) => n.jenis === 'peringatan').length;
  const penghargaanCount = notes.filter((n) => n.jenis === 'penghargaan').length;

  return (
    <DashboardLayout title="Catatan Disiplin">
      <div className="space-y-5">
        <PageHeader
          title="Catatan Disiplin Personel"
          subtitle="Pantau riwayat peringatan, penghargaan, dan catatan evaluasi personel satuan (hanya baca)."
          meta={
            <>
              <span>{peringatanCount} peringatan aktif</span>
              <span>{penghargaanCount} penghargaan</span>
            </>
          }
          actions={
            <Button variant="outline" onClick={() => void fetchNotes()} isLoading={isLoading}>
              Muat Ulang
            </Button>
          }
        />

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
          <Shield className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-primary">Akses Petugas Jaga / Provost</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Anda hanya dapat membaca catatan disiplin. Perubahan data dilakukan oleh Komandan satuan.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            placeholder="Cari nama, NRP, atau isi catatan..."
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            className="flex-1"
          />
          <div className="flex gap-1 bg-surface/40 rounded-lg p-1">
            {(['all', 'peringatan', 'penghargaan', 'catatan'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterJenis(opt)}
                aria-pressed={filterJenis === opt}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  filterJenis === opt ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {opt === 'all' ? 'Semua' : opt}
              </button>
            ))}
          </div>
        </div>

        <Table<DisciplineNote>
          columns={[
            {
              key: 'created_at',
              header: 'Tanggal',
              render: (n) =>
                new Date(n.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }),
            },
            {
              key: 'user',
              header: 'Personel',
              render: (n) => (
                <div>
                  <p className="font-medium text-text-primary">{n.user?.nama ?? '—'}</p>
                  <p className="font-mono text-xs text-text-muted">{n.user?.nrp}</p>
                </div>
              ),
            },
            {
              key: 'jenis',
              header: 'Jenis',
              render: (n) =>
                n.jenis ? (
                  <Badge variant={JENIS_BADGE[n.jenis] ?? 'neutral'}>
                    <span className="inline-flex items-center gap-1">
                      {JENIS_ICON[n.jenis]}
                      {n.jenis}
                    </span>
                  </Badge>
                ) : (
                  '—'
                ),
            },
            {
              key: 'isi',
              header: 'Catatan',
              render: (n) => <p className="text-sm text-text-primary line-clamp-2">{n.isi}</p>,
            },
            {
              key: 'creator',
              header: 'Dicatat oleh',
              render: (n) => <span className="text-sm text-text-muted">{n.creator?.nama ?? '—'}</span>,
            },
          ]}
          data={filtered}
          keyExtractor={(n) => n.id}
          isLoading={isLoading}
          emptyMessage="Tidak ada catatan disiplin"
        />
      </div>
    </DashboardLayout>
  );
}
