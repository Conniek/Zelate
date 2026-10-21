import { supabase } from './supabase';

export type SiretResult =
  'valid' | 'naf_mismatch' | 'inactive' | 'not_found' | 'error';
export type Decision = 'pending' | 'approved' | 'rejected';

export interface SalonRow {
  salon_id: string;
  name: string;
  city: string;
  status: string;
  submitted_at: string;
  siret_check_result: SiretResult;
  decision: Decision;
}

export interface SalonDetail extends SalonRow {
  phone: string;
  address_line: string;
  postal_code: string;
  siret: string;
  naf_code: string | null;
  longitude: number;
  latitude: number;
  manager: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  checked_at: string;
  decision_reason: string | null;
  decided_at: string | null;
}

export async function listSalons(filter: 'to_review' | 'all') {
  const { data, error } = await supabase.rpc('admin_list_salons', {
    p_filter: filter,
  });
  if (error) throw error;
  return data as unknown as SalonRow[];
}

export async function getSalon(id: string) {
  const { data, error } = await supabase.rpc('admin_get_salon', {
    p_salon_id: id,
  });
  if (error) throw error;
  return data as unknown as SalonDetail | null;
}

/** Returns an `errors.*` key on failure; the database error message is the code. */
export async function decideSalon(
  id: string,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_decide_salon', {
    p_salon_id: id,
    p_decision: decision,
    ...(reason ? { p_reason: reason } : {}),
  });
  if (!error) return null;
  const known = [
    'admin.salon_already_decided',
    'admin.salon_not_found',
    'validation.reject_reason_required',
  ];
  return known.includes(error.message) ? error.message : 'generic.unexpected';
}
