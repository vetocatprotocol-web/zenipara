/**
 * Cache in-memory sederhana dengan TTL (Time To Live).
 *
 * Digunakan di hooks untuk menghindari fetch ulang data yang sudah ada
 * saat user berpindah halaman dalam waktu singkat.
 *
 * Default TTL: 5 menit (300.000ms)
 *
 * Penggunaan:
 *   const cache = new SimpleCache<Task[]>();
 *
 *   // Di dalam fetchTasks:
 *   const cached = cache.get('tasks-all');
 *   if (cached) return cached;
 *   const data = await apiFetchTasks();
 *   cache.set('tasks-all', data);
 *   return data;
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 menit

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttl = ttlMs;
  }

  /** Ambil data dari cache. Kembalikan null jika tidak ada atau sudah kadaluarsa. */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  /** Simpan data ke cache dengan TTL. */
  set(key: string, data: T): void {
    this.store.set(key, { data, expiresAt: Date.now() + this.ttl });
  }

  /** Hapus satu entry (dipanggil setelah mutasi). */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Hapus semua entry. */
  clear(): void {
    this.store.clear();
  }

  /** Cek apakah entry ada dan masih fresh. */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}
