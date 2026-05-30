/**
 * handleError — Standar penanganan error di seluruh aplikasi Karyo OS.
 *
 * Penggunaan:
 *   catch (err) { setError(handleError(err, 'Gagal memuat data')); }
 *
 * Di mode development, error asli dicetak ke console agar mudah di-debug.
 * Di production, hanya pesan user-friendly yang ditampilkan.
 */
export function handleError(err: unknown, fallback: string): string {
  if (import.meta.env.DEV) {
    console.error('[KARYO OS]', err);
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return fallback;
}
