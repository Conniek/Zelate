import type { Json } from '@zelate/db-types';
import { supabase } from './supabase';

export interface SignupDraft {
  step: number;
  data: Record<string, unknown>;
}

export async function loadDraft(): Promise<SignupDraft | null> {
  const { data, error } = await supabase.rpc('get_signup_draft');
  if (error) throw error;
  return data ? (data as unknown as SignupDraft) : null;
}

export async function saveDraft(
  step: number,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc('save_signup_draft', {
    p_step: step,
    p_data: data as Json,
  });
  if (error) throw error;
}

export type SiretState = 'valid' | 'to_verify' | 'unavailable';

export async function verifySiret(siret: string): Promise<SiretState> {
  const { data, error } = await supabase.functions.invoke('verify-siret', {
    body: { siret },
  });
  if (error || !data?.ok) return 'unavailable';
  return data.data.result === 'valid' ? 'valid' : 'to_verify';
}

export type SubmitOutcome =
  { ok: true } | { ok: false; messageKey: string; field?: string };

export async function submitSignup(
  body: Record<string, unknown>,
): Promise<SubmitOutcome> {
  const { data, error } = await supabase.functions.invoke('salon-signup', {
    body,
  });
  if (!error && data?.ok) return { ok: true };
  const detail = (await readError(error)) ?? data;
  return {
    ok: false,
    messageKey: detail?.error?.messageKey ?? 'errors.generic.unexpected',
    ...(detail?.error?.field ? { field: detail.error.field } : {}),
  };
}

export async function readError(
  error: unknown,
): Promise<{ error?: { messageKey?: string; field?: string } } | null> {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.json !== 'function') return null;
  return context.json().catch(() => null);
}
