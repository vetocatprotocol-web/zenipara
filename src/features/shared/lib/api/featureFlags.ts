import { supabase } from '../supabase';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlagsState, type FeatureKey } from '../featureFlags';

interface DbFeatureFlagRow {
  feature_key: FeatureKey;
  is_enabled: boolean;
}

interface RpcErrorShape {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
}

function toError(err: unknown, fallbackMessage: string): Error {
  if (err instanceof Error) return err;

  if (typeof err === 'object' && err !== null) {
    const maybeMessage = (err as RpcErrorShape).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return new Error(maybeMessage);
    }
  }

  return new Error(fallbackMessage);
}

function isFunctionMissingError(err: unknown, functionName: string): boolean {
  if (typeof err !== 'object' || err === null) return false;

  const shape = err as RpcErrorShape;
  const code = String(shape.code ?? '');
  const joined = [shape.message, shape.details, shape.hint]
    .filter((part) => typeof part === 'string')
    .join(' ')
    .toLowerCase();

  if (code === 'PGRST202') return true;

  return joined.includes(functionName.toLowerCase())
    && (joined.includes('could not find the function') || joined.includes('does not exist'));
}

function isAmbiguousFeatureKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;

  const shape = err as RpcErrorShape;
  const joined = [shape.message, shape.details, shape.hint]
    .filter((part) => typeof part === 'string')
    .join(' ')
    .toLowerCase();

  return joined.includes('feature_key') && joined.includes('ambiguous');
}

export async function getFeatureFlags(callerId: string, callerRole: string): Promise<FeatureFlagsState> {
  const { data, error } = await supabase.rpc('get_feature_flags', {
    p_user_id: callerId,
    p_role: callerRole,
  });
  if (error) throw error;

  const rows = (data as DbFeatureFlagRow[] | null) ?? [];
  const next: FeatureFlagsState = { ...DEFAULT_FEATURE_FLAGS };

  for (const row of rows) {
    if (row.feature_key in next) {
      next[row.feature_key] = row.is_enabled;
    }
  }

  return next;
}

export async function updateFeatureFlag(
  callerId: string,
  callerRole: string,
  featureKey: FeatureKey,
  isEnabled: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('update_feature_flag', {
    p_user_id: callerId,
    p_role: callerRole,
    p_feature_key: featureKey,
    p_is_enabled: isEnabled,
  });

  if (!error) return;

  // Compatibility fallback for environments that only have the batch RPC,
  // or have an older single-RPC definition with ambiguous output-column names.
  if (isFunctionMissingError(error, 'update_feature_flag') || isAmbiguousFeatureKeyError(error)) {
    const { error: batchError } = await supabase.rpc('update_feature_flags', {
      p_user_id: callerId,
      p_role: callerRole,
      p_feature_flags: { [featureKey]: isEnabled },
    });

    if (!batchError) return;
    throw toError(batchError, 'Gagal memperbarui pengaturan fitur');
  }

  throw toError(error, 'Gagal memperbarui pengaturan fitur');
}

export async function updateFeatureFlags(
  callerId: string,
  callerRole: string,
  featureFlags: FeatureFlagsState,
): Promise<void> {
  const { error } = await supabase.rpc('update_feature_flags', {
    p_user_id: callerId,
    p_role: callerRole,
    p_feature_flags: featureFlags,
  });

  if (!error) return;

  // Compatibility fallback for environments that only have the single-item RPC.
  if (isFunctionMissingError(error, 'update_feature_flags') || isAmbiguousFeatureKeyError(error)) {
    for (const [featureKey, isEnabled] of Object.entries(featureFlags) as Array<[FeatureKey, boolean]>) {
      const { error: singleError } = await supabase.rpc('update_feature_flag', {
        p_user_id: callerId,
        p_role: callerRole,
        p_feature_key: featureKey,
        p_is_enabled: isEnabled,
      });

      if (singleError) {
        throw toError(singleError, 'Gagal memperbarui pengaturan fitur global');
      }
    }
    return;
  }

  throw toError(error, 'Gagal memperbarui pengaturan fitur global');
}