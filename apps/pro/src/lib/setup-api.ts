import type { Week } from '@zelate/salon-setup';
import { supabase } from './supabase';

export interface SetupSalon {
  id: string;
  name: string;
  status: string;
  setup_test_passed_at: string | null;
}

export interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  required_specialty_code: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface ClosureRow {
  id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
}

/** The manager's own salon; RLS only lets staff and admins read salons. */
export async function loadOwnSalon(): Promise<SetupSalon | null> {
  const { data, error } = await supabase
    .from('salons')
    .select('id, name, status, setup_test_passed_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadHours(salonId: string): Promise<Week> {
  const { data, error } = await supabase
    .from('opening_hours')
    .select('weekday, opens_at, closes_at')
    .eq('salon_id', salonId)
    .order('opens_at');
  if (error) throw error;
  const week: Week = {};
  for (const row of data) {
    (week[row.weekday] ??= []).push({
      opens: row.opens_at.slice(0, 5),
      closes: row.closes_at.slice(0, 5),
    });
  }
  return week;
}

/** Returns an error code (`validation.*`) or null. */
export async function saveHours(week: Week): Promise<string | null> {
  const rows = Object.entries(week).flatMap(([day, ranges]) =>
    ranges.map((range) => ({
      weekday: Number(day),
      opens_at: range.opens,
      closes_at: range.closes,
    })),
  );
  const { error } = await supabase.rpc('replace_opening_hours', {
    p_hours: rows,
  });
  return error ? error.message : null;
}

export async function loadClosures(salonId: string): Promise<ClosureRow[]> {
  const { data, error } = await supabase
    .from('salon_closures')
    .select('id, starts_on, ends_on, reason')
    .eq('salon_id', salonId)
    .order('starts_on');
  if (error) throw error;
  return data;
}

export async function addClosure(
  salonId: string,
  input: { startsOn: string; endsOn: string; reason: string },
): Promise<boolean> {
  const { error } = await supabase.from('salon_closures').insert({
    salon_id: salonId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    reason: input.reason.trim() === '' ? null : input.reason.trim(),
  });
  return !error;
}

export async function removeClosure(id: string): Promise<boolean> {
  const { error } = await supabase.from('salon_closures').delete().eq('id', id);
  return !error;
}

export async function loadSpecialties(): Promise<string[]> {
  const { data, error } = await supabase
    .from('specialties')
    .select('code')
    .order('sort_order');
  if (error) throw error;
  return data.map((row) => row.code);
}

export async function loadServices(salonId: string): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from('services')
    .select(
      'id, name, duration_minutes, price_cents, required_specialty_code, is_active, sort_order',
    )
    .eq('salon_id', salonId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export interface ServiceWrite {
  name: string;
  durationMinutes: number;
  priceCents: number;
  specialty: string | null;
  isActive: boolean;
}

export async function createService(
  salonId: string,
  input: ServiceWrite,
  sortOrder: number,
): Promise<boolean> {
  const { error } = await supabase.from('services').insert({
    salon_id: salonId,
    name: input.name.trim(),
    duration_minutes: input.durationMinutes,
    price_cents: input.priceCents,
    required_specialty_code: input.specialty,
    is_active: input.isActive,
    sort_order: sortOrder,
  });
  return !error;
}

export async function updateService(
  id: string,
  input: ServiceWrite,
): Promise<boolean> {
  const { error } = await supabase
    .from('services')
    .update({
      name: input.name.trim(),
      duration_minutes: input.durationMinutes,
      price_cents: input.priceCents,
      required_specialty_code: input.specialty,
      is_active: input.isActive,
    })
    .eq('id', id);
  return !error;
}

/** « Au moins 1 coiffeur actif » (K35): a stylist, or the manager who cuts hair. */
export async function countActiveHairdressers(
  salonId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('salon_members')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .eq('status', 'active')
    .eq('is_hairdressing', true);
  if (error) throw error;
  return count ?? 0;
}
