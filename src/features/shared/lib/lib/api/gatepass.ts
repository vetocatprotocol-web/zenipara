import { supabase } from '../supabase';
import type { GatePass } from '../../types';
import { ensureSessionContext } from './sessionContext';

const READ_RETRY_MAX_ATTEMPTS = 3;
const READ_RETRY_BASE_MS = 220;
const READ_RETRY_MAX_MS = 1200;
const READ_CIRCUIT_OPEN_MS = 12000;
const READ_CIRCUIT_FAILURE_THRESHOLD = 5;
const READ_MAX_CONCURRENT = 2;

const readCircuitState = {
  consecutiveFailures: 0,
  openedUntil: 0,
};

const readTelemetry = {
  totalCalls: 0,
  retries: 0,
  failures: 0,
  successes: 0,
  circuitOpenHits: 0,
  circuitOpenedCount: 0,
  queuedCalls: 0,
  dequeuedCalls: 0,
};

let readActiveCount = 0;
const readQueue: Array<() => void> = [];

function runWithReadConcurrency<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const execute = () => {
      readActiveCount += 1;
      void operation()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          readActiveCount = Math.max(0, readActiveCount - 1);
          const next = readQueue.shift();
          if (next) {
            readTelemetry.dequeuedCalls += 1;
            next();
          }
        });
    };

    if (readActiveCount < READ_MAX_CONCURRENT) {
      execute();
      return;
    }

    readTelemetry.queuedCalls += 1;
    readQueue.push(execute);
  });
}

export interface GatePassReadResilienceStats {
  totalCalls: number;
  retries: number;
  failures: number;
  successes: number;
  circuitOpenHits: number;
  circuitOpenedCount: number;
  queuedCalls: number;
  dequeuedCalls: number;
  activeReads: number;
  pendingQueue: number;
  circuitOpenedUntil: number;
}

export function getGatePassReadResilienceStats(): GatePassReadResilienceStats {
  return {
    ...readTelemetry,
    activeReads: readActiveCount,
    pendingQueue: readQueue.length,
    circuitOpenedUntil: readCircuitState.openedUntil,
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientReadError(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : null;
  if (status === 408 || status === 409 || status === 425 || status === 429) return true;
  if (status !== null && status >= 500) return true;

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('timeout')
    || message.includes('temporar')
    || message.includes('429')
    || message.includes('503')
    || message.includes('502')
    || message.includes('504')
  );
}

function markReadFailure() {
  readCircuitState.consecutiveFailures += 1;
  if (readCircuitState.consecutiveFailures >= READ_CIRCUIT_FAILURE_THRESHOLD) {
    if (Date.now() >= readCircuitState.openedUntil) {
      readTelemetry.circuitOpenedCount += 1;
    }
    readCircuitState.openedUntil = Date.now() + READ_CIRCUIT_OPEN_MS;
  }
}

function markReadSuccess() {
  readCircuitState.consecutiveFailures = 0;
  readCircuitState.openedUntil = 0;
}

async function withResilientRead<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
  readTelemetry.totalCalls += 1;

  if (Date.now() < readCircuitState.openedUntil) {
    readTelemetry.circuitOpenHits += 1;
    throw new Error('Layanan gate pass sedang sibuk. Coba lagi beberapa detik lagi.');
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= READ_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await runWithReadConcurrency(operation);
      markReadSuccess();
      readTelemetry.successes += 1;
      return result;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < READ_RETRY_MAX_ATTEMPTS && isTransientReadError(error);
      if (!canRetry) break;

      readTelemetry.retries += 1;
      const exponential = Math.min(READ_RETRY_MAX_MS, READ_RETRY_BASE_MS * (2 ** (attempt - 1)));
      const jitter = Math.floor(Math.random() * 90);
      await sleep(exponential + jitter);
    }
  }

  markReadFailure();
  readTelemetry.failures += 1;
  if (import.meta.env.DEV) {
    console.warn(`[GatePassAPI] Read operation failed: ${operationName}`, lastError);
  }

  throw (lastError instanceof Error ? lastError : new Error('Gagal memuat data gate pass'));
}

export async function fetchGatePassesByUser(callerId: string, callerRole: string, userId: string): Promise<GatePass[]> {
  return withResilientRead('fetchGatePassesByUser', async () => {
    await ensureSessionContext(callerId, callerRole);
    const { data, error } = await supabase.rpc('api_get_gate_passes', {
      p_user_id: callerId,
      p_role: callerRole,
      p_target_user_id: userId,
      p_status_filter: null,
    });
    if (error) throw error;
    return (data as GatePass[]) ?? [];
  });
}

export async function fetchGatePassesByUserAndStatus(callerId: string, callerRole: string, userId: string, status: GatePass['status']): Promise<GatePass[]> {
  return withResilientRead('fetchGatePassesByUserAndStatus', async () => {
    await ensureSessionContext(callerId, callerRole);
    const { data, error } = await supabase.rpc('api_get_gate_passes', {
      p_user_id: callerId,
      p_role: callerRole,
      p_target_user_id: userId,
      p_status_filter: status,
    });
    if (error) throw error;
    return (data as GatePass[]) ?? [];
  });
}

export async function fetchAllGatePasses(callerId: string, callerRole: string): Promise<GatePass[]> {
  return withResilientRead('fetchAllGatePasses', async () => {
    await ensureSessionContext(callerId, callerRole);
    const { data, error } = await supabase.rpc('api_get_gate_passes', {
      p_user_id: callerId,
      p_role: callerRole,
      p_target_user_id: null,
      p_status_filter: null,
    });
    if (error) throw error;
    return (data as GatePass[]) ?? [];
  });
}

export async function fetchGatePassByQrToken(callerId: string, callerRole: string, qrToken: string): Promise<GatePass | null> {
  return withResilientRead('fetchGatePassByQrToken', async () => {
    await ensureSessionContext(callerId, callerRole);
    const { data, error } = await supabase
      .from('gate_pass')
      .select('*, user:user_id(id,nama,nrp,pangkat,satuan)')
      .eq('qr_token', qrToken)
      .single();
    if (error) return null;
    return (data as GatePass) ?? null;
  });
}

export interface InsertGatePassResponse {
  gate_pass_id: string;
  auto_approved: boolean;
  status: 'approved' | 'pending';
  approval_reason: string;
}

export async function insertGatePass(
  callerId: string,
  callerRole: string,
  payload: Partial<GatePass> & { user_id: string; qr_token: string }
): Promise<InsertGatePassResponse> {
  await ensureSessionContext(callerId, callerRole);

  // Backend RPC currently requires planned times. Keep UX simple by
  // auto-generating a sane default window when the form does not ask for it.
  const plannedOutAt = new Date();
  const plannedReturnAt = new Date(plannedOutAt.getTime() + (8 * 60 * 60 * 1000));

  const { data, error } = await supabase.rpc('api_insert_gate_pass', {
    p_user_id: payload.user_id,
    p_caller_role: callerRole,
    p_keperluan: payload.keperluan ?? '',
    p_tujuan: payload.tujuan ?? '',
    p_waktu_keluar: plannedOutAt.toISOString(),
    p_waktu_kembali: plannedReturnAt.toISOString(),
    p_qr_token: payload.qr_token,
    p_submit_latitude: payload.submit_latitude ?? null,
    p_submit_longitude: payload.submit_longitude ?? null,
    p_submit_accuracy: payload.submit_accuracy ?? null,
  });
  if (error) throw error;
  return (data as InsertGatePassResponse) ?? { gate_pass_id: '', auto_approved: false, status: 'pending', approval_reason: '' };
}

export interface UpdateGatePassStatusResponse {
  gate_pass_id: string;
  status: string;
  message: string;
}

export async function patchGatePassStatus(
  callerId: string,
  callerRole: string,
  id: string,
  status: GatePass['status'],
  approvedBy?: string,
  approvalReason?: string,
): Promise<UpdateGatePassStatusResponse> {
  await ensureSessionContext(callerId, callerRole);
  const { data, error } = await supabase.rpc('api_update_gate_pass_status', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_id: id,
    p_status: status,
    p_approved_by: approvedBy ?? null,
    p_approval_reason: approvalReason ?? null,
  });
  if (error) throw error;
  return (data as UpdateGatePassStatusResponse) ?? { gate_pass_id: id, status, message: 'Updated' };
}

/** Response shape returned by the `server_scan_gate_pass` Supabase RPC. */
interface ScanGatePassResponse {
  message?: string;
}

export async function rpcScanGatePass(callerId: string, callerRole: string, qrToken: string): Promise<string> {
  await ensureSessionContext(callerId, callerRole);
  const { data, error } = await supabase.rpc('server_scan_gate_pass', { p_qr_token: qrToken });
  if (error || !data) throw new Error(error?.message ?? 'QR tidak valid');
  return (data as ScanGatePassResponse).message ?? 'Scan berhasil';
}

export interface ApprovalStats {
  total_gate_passes: number;
  completed: number;
  pending: number;
  rejected: number;
  auto_approved: number;
  approval_rate: number;
}

export async function fetchApprovalStats(callerId: string, userId: string): Promise<ApprovalStats | null> {
  return withResilientRead('fetchApprovalStats', async () => {
    await ensureSessionContext(callerId, 'prajurit');
    const { data, error } = await supabase.rpc('api_get_approval_stats', {
      p_user_id: userId,
    });
    if (error) return null;
    return (data?.[0] as ApprovalStats) ?? null;
  });
}
