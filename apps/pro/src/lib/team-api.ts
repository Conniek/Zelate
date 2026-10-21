import { readError } from './signup-api';
import { supabase } from './supabase';

export interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  status: 'invited' | 'active' | 'deactivated';
}

export async function loadTeam(salonId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('salon_members')
    .select('id, first_name, last_name, status')
    .eq('salon_id', salonId)
    .eq('role', 'stylist')
    .order('created_at');
  if (error) throw error;
  return data;
}

export type TeamOutcome = { ok: true } | { ok: false; messageKey: string };

async function call(
  name: string,
  body: Record<string, unknown>,
): Promise<TeamOutcome> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error && data?.ok) return { ok: true };
  const detail = (await readError(error)) ?? data;
  return {
    ok: false,
    messageKey: detail?.error?.messageKey ?? 'errors.generic.unexpected',
  };
}

export function inviteMember(input: {
  firstName: string;
  lastName: string;
  email: string;
  specialties: string[];
}) {
  return call('invite-member', input);
}

export function activateInvitation(token: string) {
  return call('activate-invitation', { token });
}
