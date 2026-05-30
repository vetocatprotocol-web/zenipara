import { useState } from 'react';
import { MapPin, Navigation2 } from 'lucide-react';
import { useGPSTracking } from '../../hooks/useGPSTracking';
import { CardListSkeleton } from '../common/Skeleton';
import Button from '../common/Button';
import type { GPSLocation } from '../../hooks/useGPSTracking';

interface GPSTrackingHistoryProps {
  maxHeight?: string;
  limit?: number;
}

export default function GPSTrackingHistory({ maxHeight = 'max-h-96', limit = 50 }: GPSTrackingHistoryProps) {
  const { locations, isLoading, error } = useGPSTracking();
  const [selectedLocation, setSelectedLocation] = useState<GPSLocation | null>(null);

  if (isLoading) {
    return <CardListSkeleton count={3} />;
  }

  if (error) {
    return (
      <div className="app-card border border-accent-red/20 bg-accent-red/5 p-4 text-sm text-accent-red">
        Gagal memuat riwayat lokasi GPS: {error}
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="app-card border border-dashed border-surface/50 p-6 text-center text-text-muted">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Belum ada riwayat lokasi GPS</p>
      </div>
    );
  }

  const displayed = locations.slice(0, limit);

  const eventTypeLabel = (type: string): string => {
    switch (type) {
      case 'check_in':
        return 'Absen Masuk';
      case 'check_out':
        return 'Absen Pulang';
      case 'gate_pass_submit':
        return 'Pengajuan Izin Keluar';
      default:
        return type;
    }
  };

  const eventTypeColor = (type: string): string => {
    switch (type) {
      case 'check_in':
        return 'bg-success/20 text-success';
      case 'check_out':
        return 'bg-accent-blue/20 text-accent-blue';
      case 'gate_pass_submit':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-surface text-text-muted';
    }
  };

  const handleOpenMap = (loc: GPSLocation): void => {
    const mapUrl = `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
    window.open(mapUrl, '_blank');
  };

  return (
    <div className="app-card">
      <div className="p-4 sm:p-5 border-b border-surface/30">
        <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Riwayat Lokasi GPS
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Tracking lokasi otomatis dari absensi dan gate pass ({locations.length} total)
        </p>
      </div>

      <div className={`${maxHeight} overflow-y-auto divide-y divide-surface/30`}>
        {displayed.map((loc) => (
          <div
            key={loc.id}
            className="p-4 sm:p-5 hover:bg-surface/30 transition-colors cursor-pointer"
            onClick={() => setSelectedLocation(loc)}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${eventTypeColor(loc.eventType)}`}>
                    {eventTypeLabel(loc.eventType)}
                  </span>
                </div>
                <p className="font-medium text-text-primary text-sm">
                  {loc.userName ?? 'Tidak Diketahui'}
                </p>
                <p className="text-xs text-text-muted font-mono">{loc.userNrp || '—'}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenMap(loc);
                }}
                className="shrink-0"
              >
                <Navigation2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-text-muted mb-2">
              <div>
                <span className="text-text-muted/70">Lat:</span>
                <br />
                <span className="font-mono text-text-primary">{loc.latitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-text-muted/70">Lon:</span>
                <br />
                <span className="font-mono text-text-primary">{loc.longitude.toFixed(6)}</span>
              </div>
            </div>

            {loc.accuracy && (
              <p className="text-xs text-text-muted">
                Akurasi: ±{loc.accuracy.toFixed(1)}m
              </p>
            )}

            <p className="text-xs text-text-muted/70 mt-2">
              {new Date(loc.eventTime).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          </div>
        ))}
      </div>

      {locations.length > limit && (
        <div className="p-3 text-xs text-text-muted text-center border-t border-surface/30">
          +{locations.length - limit} lokasi lainnya
        </div>
      )}

      {selectedLocation && (
        <div className="p-4 sm:p-5 border-t border-surface/30 bg-surface/20">
          <p className="text-xs font-medium text-text-muted mb-2">Detail Lokasi Terpilih:</p>
          <p className="font-mono text-xs text-text-primary mb-2">
            {selectedLocation.latitude.toFixed(8)}, {selectedLocation.longitude.toFixed(8)}
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleOpenMap(selectedLocation)}
            className="w-full"
          >
            <Navigation2 className="h-4 w-4 mr-1" />
            Buka di Google Maps
          </Button>
        </div>
      )}
    </div>
  );
}
