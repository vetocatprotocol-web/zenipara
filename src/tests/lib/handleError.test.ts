import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleError } from '@/features/shared/lib/handleError';

describe('handleError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the Error message when passed an Error instance', () => {
    const err = new Error('something went wrong');
    const result = handleError(err, 'Fallback pesan');
    expect(result).toBe('something went wrong');
  });

  it('returns fallback string when passed a non-Error value (string)', () => {
    const result = handleError('raw string error', 'Fallback pesan');
    expect(result).toBe('Fallback pesan');
  });

  it('returns fallback string when passed null', () => {
    const result = handleError(null, 'Fallback pesan');
    expect(result).toBe('Fallback pesan');
  });

  it('returns fallback string when passed undefined', () => {
    const result = handleError(undefined, 'Fallback pesan');
    expect(result).toBe('Fallback pesan');
  });

  it('returns fallback string when passed a plain object', () => {
    const result = handleError({ code: 500 }, 'Fallback pesan');
    expect(result).toBe('Fallback pesan');
  });

  it('returns fallback string when Error has empty message', () => {
    const err = new Error('');
    const result = handleError(err, 'Fallback pesan');
    // Empty string is falsy — falls back
    expect(result).toBe('Fallback pesan');
  });

  it('logs to console in DEV mode', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Vitest runs with import.meta.env.DEV = true in test mode
    handleError(new Error('dev error'), 'fallback');
    expect(consoleSpy).toHaveBeenCalled();
  });
});
