/**
 * metrics.ts — Modul observabilitas ringan untuk Karyo OS.
 *
 * Menyediakan:
 *   - Pengukuran waktu load halaman pertama (Time to Interactive)
 *   - Pelacakan jumlah error API per operasi
 *   - Fungsi laporan ringkasan untuk keperluan debugging dan sprint review
 *
 * Catatan: data hanya disimpan di memori browser. Tidak ada pengiriman ke server.
 */

interface ApiErrorRecord {
  operation: string;
  count: number;
  lastMessage: string;
  lastAt: string;
}

const apiErrors = new Map<string, ApiErrorRecord>();
let pageLoadMs: number | null = null;

/** Rekam durasi load halaman pertama menggunakan Performance API. */
export function measurePageLoad(): void {
  if (pageLoadMs !== null) return; // sudah diukur
  if (typeof performance === 'undefined') return;

  const onLoad = () => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      pageLoadMs = Math.round(nav.domInteractive - nav.startTime);
    } else {
      pageLoadMs = Math.round(performance.now());
    }
    if (import.meta.env.DEV) {
      console.info(`[KARYO OS Metrics] Page load: ${pageLoadMs}ms`);
    }
  };

  if (document.readyState === 'complete') {
    onLoad();
  } else {
    window.addEventListener('load', onLoad, { once: true });
  }
}

/**
 * Rekam satu kejadian error API.
 *
 * @param operation  Nama operasi (misalnya 'fetchTasks', 'insertLeaveRequest')
 * @param message    Pesan error yang diterima
 */
export function recordApiError(operation: string, message: string): void {
  const existing = apiErrors.get(operation);
  if (existing) {
    existing.count += 1;
    existing.lastMessage = message;
    existing.lastAt = new Date().toISOString();
  } else {
    apiErrors.set(operation, {
      operation,
      count: 1,
      lastMessage: message,
      lastAt: new Date().toISOString(),
    });
  }
}

/** Ambil ringkasan semua metrik yang terkumpul (untuk laporan / debugging). */
export function getMetricsSummary(): {
  pageLoadMs: number | null;
  apiErrors: ApiErrorRecord[];
} {
  return {
    pageLoadMs,
    apiErrors: Array.from(apiErrors.values()),
  };
}

/** Cetak ringkasan metrik ke console (khusus mode DEV). */
export function logMetricsSummary(): void {
  if (!import.meta.env.DEV) return;
  const summary = getMetricsSummary();
  console.group('[KARYO OS Metrics] Summary');
  console.info('Page load (ms):', summary.pageLoadMs ?? 'belum diukur');
  if (summary.apiErrors.length > 0) {
    console.table(summary.apiErrors);
  } else {
    console.info('API errors: tidak ada');
  }
  console.groupEnd();
}

/** Reset semua metrik (berguna untuk pengujian). */
export function resetMetrics(): void {
  apiErrors.clear();
  pageLoadMs = null;
}
