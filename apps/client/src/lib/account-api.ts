/**
 * F-C11 (U-13): the client's own profile, export and deletion. The first
 * name is written straight to his `profiles` row (K32); export and deletion
 * go through `account-export` and `account-delete` (K17).
 */
import { supabase } from './supabase';

export async function loadFirstName(): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name')
    .maybeSingle();
  if (error) throw new Error('profile read failed');
  return (data?.first_name as string | undefined) ?? null;
}

export async function updateFirstName(firstName: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const id = session.session?.user.id;
  if (!id) return false;
  const { error } = await supabase
    .from('profiles')
    .update({ first_name: firstName })
    .eq('id', id);
  return !error;
}

/** K18: the consent of the place in progress, with its date. */
export async function loadConsentAt(ticketId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('notifications_consent_at')
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw new Error('ticket read failed');
  return (data?.notifications_consent_at as string | null | undefined) ?? null;
}

/** The JSON file of `account-export`, as text; null when it failed. */
export async function exportData(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('account-export', {
    method: 'GET',
  });
  if (error || !data?.ok) return null;
  return JSON.stringify(data.data, null, 2);
}

export async function deleteAccount(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('account-delete', {
    body: {},
  });
  return !error && data?.ok === true;
}
