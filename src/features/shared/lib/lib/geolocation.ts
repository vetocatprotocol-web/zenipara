export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

interface GeoOptions {
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
}

/**
 * Ambil lokasi GPS terbaru user.
 * Return null bila browser/perizinan/lokasi tidak tersedia agar alur tetap berjalan.
 */
export async function getCurrentGeoCoordinates(options: GeoOptions = {}): Promise<GeoCoordinates | null> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }

  const {
    timeoutMs = 8000,
    maximumAgeMs = 60_000,
    enableHighAccuracy = true,
  } = options;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
          accuracy: Number.isFinite(position.coords.accuracy) ? Number(position.coords.accuracy.toFixed(2)) : null,
          capturedAt: new Date().toISOString(),
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: maximumAgeMs,
      }
    );
  });
}