import { readError } from './signup-api';
import { supabase } from './supabase';

export type QrOutcome =
  { ok: true; blob: Blob } | { ok: false; messageKey: string };

const FAILED = { ok: false, messageKey: 'errors.generic.unexpected' } as const;

async function build(salonId: string, rotate: boolean): Promise<QrOutcome> {
  const { data, error } = await supabase.functions.invoke('regenerate-qr', {
    body: { rotate },
  });
  if (error || !data?.ok) {
    const detail = (await readError(error)) ?? data;
    return {
      ok: false,
      messageKey: detail?.error?.messageKey ?? FAILED.messageKey,
    };
  }
  return download(salonId);
}

async function download(salonId: string): Promise<QrOutcome> {
  const { data, error } = await supabase.storage
    .from('qr-posters')
    .download(`${salonId}/poster.pdf`);
  return error || !data ? FAILED : { ok: true, blob: data };
}

/** Downloads the current poster, building it the first time. */
export async function fetchPoster(salonId: string): Promise<QrOutcome> {
  const existing = await download(salonId);
  return existing.ok ? existing : build(salonId, false);
}

export function regeneratePoster(salonId: string): Promise<QrOutcome> {
  return build(salonId, true);
}
