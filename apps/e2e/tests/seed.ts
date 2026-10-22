/**
 * Seed helpers shared by the end-to-end tests from DEV-8 on: accounts, a
 * published salon open all day, and the Pro sign-in. Service role only.
 */
import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { localEnv } from './env';
import { fr } from './fr';

export const env = localEnv();
export const db = createClient(env.apiUrl, env.serviceRoleKey, {
  auth: { persistSession: false },
});
export const run = Date.now().toString(36);
const PASSWORD = 'e2e-Password-2026!';

export interface Account {
  email: string;
  password: string;
  id: string;
}

/** Seed step: fail with the database's own message. */
export function must<T>(
  result: { data: T; error: { message: string } | null },
  step: string,
): T {
  if (result.error) throw new Error(`${step}: ${result.error.message}`);
  return result.data;
}

export async function account(
  prefix: string,
  firstName: string,
): Promise<Account> {
  const email = `${prefix}-${run}@e2e.zelate`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('user creation failed');
  must(
    await db.from('profiles').insert({
      id: data.user.id,
      first_name: firstName,
      is_guest: false,
      email,
    }),
    'profile',
  );
  return { email, password: PASSWORD, id: data.user.id };
}

/** Paris wall clock: ISO weekday (Monday = 1), date and minutes since midnight. */
export function parisNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return {
    weekday: weekdays.indexOf(parts.weekday ?? '') + 1,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Open until midnight: late in the evening a queue is full by design (H9). */
export const lateEvening = () => parisNow().minutes >= 22 * 60 + 30;

/** A published salon, open all day with its queue open, a manager and one stylist. */
export async function openSalon(name: string) {
  const manager = await account(`m-${name}`, 'Léa');
  const stylist = await account(`s-${name}`, 'Sam');
  const salon = must(
    await db
      .from('salons')
      .insert({
        slug: `e2e-${name}-${run}`,
        name: `Salon ${name} ${run}`,
        phone: '+33639980050',
        address_line: '1 rue de la Paix',
        postal_code: '75002',
        city: 'Paris',
        location: 'SRID=4326;POINT(2.331 48.869)',
        siret: '73282932000074',
        status: 'approved',
        created_by: manager.id,
      })
      .select('id, slug, qr_token')
      .single(),
    'salon',
  );
  if (!salon) throw new Error('salon creation failed');
  must(
    await db.from('opening_hours').insert(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        salon_id: salon.id,
        weekday,
        opens_at: '00:00',
        closes_at: '24:00',
      })),
    ),
    'opening hours',
  );
  must(
    await db
      .from('salons')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        queue_status: 'open',
      })
      .eq('id', salon.id),
    'publish',
  );
  must(
    await db.from('services').insert({
      salon_id: salon.id,
      name: 'Coupe',
      duration_minutes: 30,
      price_cents: 2500,
    }),
    'service',
  );
  must(
    await db.from('salon_members').insert([
      {
        salon_id: salon.id,
        profile_id: manager.id,
        role: 'manager',
        status: 'active',
        first_name: 'Léa',
        last_name: 'Martin',
        email: manager.email,
        is_hairdressing: false,
      },
      {
        salon_id: salon.id,
        profile_id: stylist.id,
        role: 'stylist',
        status: 'active',
        first_name: 'Sam',
        last_name: 'Durand',
        email: stylist.email,
        // A bulk insert sends null for missing columns, not their default.
        is_hairdressing: true,
      },
    ]),
    'members',
  );
  return {
    salonId: salon.id as string,
    slug: salon.slug as string,
    qrToken: salon.qr_token as string,
    manager,
    stylist,
  };
}

/** Zelaté Pro sign-in by e-mail and password. */
export async function proSignIn(page: Page, who: Account, next: string) {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page
    .getByLabel(fr('pro-manager', 'signin.email'), { exact: true })
    .fill(who.email);
  await page
    .getByLabel(fr('pro-manager', 'signin.password'), { exact: true })
    .fill(who.password);
  await page
    .getByRole('button', { name: fr('pro-manager', 'signin.submit') })
    .click();
}

/**
 * The test phones of `supabase/config.toml` are shared by every run: their
 * places left by an earlier local run are cancelled, so that a new one can
 * join (one active place per client).
 */
export async function freeTestPhones() {
  const { data: salons } = await db
    .from('salons')
    .select('id')
    .like('slug', 'e2e-client-%');
  const ids = (salons ?? []).map((s) => s.id as string);
  if (ids.length === 0) return;
  await db
    .from('tickets')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'client_cancelled',
    })
    .in('salon_id', ids)
    .in('status', ['waiting', 'called', 'in_service', 'pending_confirmation']);
}
