import { createClient } from '@supabase/supabase-js';
import { devices, expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { localEnv } from './env';
import { fr } from './fr';

/**
 * DEV-7 « Fini quand » (IMPLEMENTATION_PLAN): a walk-in is registered from the
 * manager board in under 10 s and appears in the stylist space in under 2 s.
 * Then the manager removes the ticket and the stylist's list follows.
 */
const env = localEnv();
const db = createClient(env.apiUrl, env.serviceRoleKey, {
  auth: { persistSession: false },
});

const run = Date.now().toString(36);

/** Seed step: fail with the database's own message. */
function must<T>(
  result: { data: T; error: { message: string } | null },
  step: string,
): T {
  if (result.error) throw new Error(`${step}: ${result.error.message}`);
  return result.data;
}
const PASSWORD = 'e2e-Password-2026!';

interface Account {
  email: string;
  password: string;
  id: string;
}

async function account(prefix: string, firstName: string): Promise<Account> {
  const email = `${prefix}-${run}@e2e.zelate`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('user creation failed');
  await db.from('profiles').insert({
    id: data.user.id,
    first_name: firstName,
    is_guest: false,
    email,
  });
  return { email, password: PASSWORD, id: data.user.id };
}

/** An approved salon, open every day all day, a manager and one stylist. */
async function readySalon(name: string) {
  const manager = await account(`m-${name}`, 'Léa');
  const stylist = await account(`s-${name}`, 'Sam');
  const { data: salon, error } = await db
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
    .select('id')
    .single();
  if (error || !salon) throw error ?? new Error('salon creation failed');
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
    await db.from('services').insert({
      salon_id: salon.id,
      name: 'Coupe',
      duration_minutes: 30,
      price_cents: 2500,
    }),
    'service',
  );
  const members = must(
    await db
      .from('salon_members')
      .insert([
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
      ])
      .select('id, role'),
    'members',
  );
  const stylistMember = members?.find((m) => m.role === 'stylist');
  const managerMember = members?.find((m) => m.role === 'manager');
  if (!stylistMember || !managerMember) {
    throw new Error('member creation failed');
  }
  return {
    salonId: salon.id as string,
    manager,
    stylist,
    stylistMemberId: stylistMember.id as string,
    managerMemberId: managerMember.id as string,
  };
}

async function signIn(page: Page, who: Account, next: string) {
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

/** Where each page went and what it logged, for failure messages. */
const trail = new WeakMap<Page, string[]>();
function track(page: Page): Page {
  const lines: string[] = [];
  trail.set(page, lines);
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) lines.push(`nav ${frame.url()}`);
  });
  page.on('console', (m) =>
    lines.push(`${m.type()} ${m.text().slice(0, 160)}`),
  );
  page.on('response', (r) => {
    if (r.status() >= 400) lines.push(`${r.status()} ${r.url().slice(0, 120)}`);
  });
  return page;
}

/** The stylist uses his own phone (ADR-007). */
async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  return track(await context.newPage());
}

const WALK_IN_BUDGET_MS = 10_000;
const STYLIST_BUDGET_MS = 2_000;

test('a walk-in is registered in under 10 s and reaches the stylist in under 2 s (DEV-7)', async ({
  browser,
}) => {
  const { salonId, manager, stylist } = await readySalon('board');
  must(
    await db
      .from('salons')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', salonId),
    'publish',
  );
  const firstName = 'Zoé';
  const digits = String(600000000 + (Date.now() % 99999999)).padStart(9, '6');

  const managerPage = await browser.newPage();
  await signIn(managerPage, manager, '/dashboard');
  await expect(
    managerPage.getByRole('heading', { name: `Salon board ${run}` }),
  ).toBeVisible();

  // F-M2: the manager opens the queue.
  await managerPage
    .getByRole('button', {
      name: fr('pro-manager', 'queue_status.open'),
      exact: true,
    })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('salons')
        .select('queue_status')
        .eq('id', salonId)
        .single();
      return data?.queue_status;
    })
    .toBe('open');

  // The stylist is already on his queue, on his phone.
  const page = await phone(browser);
  await signIn(page, stylist, '/stylist/queue');
  await page
    .getByRole('button', { name: fr('pro-stylist', 'presence.ready') })
    .click();
  await expect(page.getByText(/Statut : Hors ligne/)).toHaveCount(0);
  // The measure starts once the phone listens to the salon channel.
  await expect(page.locator('[data-realtime="on"]')).toBeVisible();

  // The stopwatch starts when the manager opens the form.
  const started = Date.now();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'walk_in.open') })
    .click();
  const dialog = managerPage.getByRole('dialog');
  await dialog
    .getByLabel(fr('pro-manager', 'walk_in.first_name'), { exact: true })
    .fill(firstName);
  await dialog.getByLabel(fr('pro-manager', 'walk_in.phone')).fill(digits);
  // The server's answer is the moment the client is in the queue.
  const written = managerPage.waitForResponse(
    (response) =>
      response.url().includes('/functions/v1/queue-command') &&
      response.request().postData()?.includes('register_walk_in') === true,
  );
  await dialog
    .getByRole('button', { name: fr('pro-manager', 'walk_in.submit') })
    .click();
  expect((await written).ok()).toBe(true);
  const writtenAt = Date.now();
  expect(writtenAt - started).toBeLessThan(WALK_IN_BUDGET_MS);

  // Stylist side: measured from the write, not from the board's own re-read.
  await expect(page.getByText(firstName).first()).toBeVisible({
    timeout: STYLIST_BUDGET_MS,
  });
  expect(Date.now() - writtenAt).toBeLessThan(STYLIST_BUDGET_MS);
  await expect(
    managerPage.getByRole('status').filter({
      hasText: fr('pro-manager', 'walk_in.success', {
        first_name: firstName,
      }),
    }),
  ).toBeVisible();

  // The board shows him in the stylist's column.
  await expect(managerPage.getByText(firstName).first()).toBeVisible();

  // F-M9: the manager removes him, with a reason.
  await managerPage
    .getByRole('button', { name: new RegExp(firstName) })
    .click();
  const panel = managerPage.getByRole('dialog');
  await panel
    .getByRole('button', { name: fr('pro-manager', 'ticket_panel.remove') })
    .click();
  await panel.getByLabel(fr('pro-manager', 'remove.reason.duplicate')).check();
  await panel
    .getByRole('button', { name: fr('pro-manager', 'remove.submit') })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('tickets')
        .select('status, removal_reason')
        .eq('salon_id', salonId)
        .eq('display_name', firstName)
        .single();
      return `${data?.status}/${data?.removal_reason}`;
    })
    .toBe('cancelled/duplicate');
  await expect(page.getByText(firstName)).toHaveCount(0, { timeout: 15_000 });
});

test('absence preview is shown before it is confirmed (DEV-7, S-11)', async ({
  browser,
}) => {
  const { salonId, manager, stylistMemberId } = await readySalon('absent');
  const managerPage = await browser.newPage();
  await signIn(managerPage, manager, '/dashboard');
  await managerPage
    .getByRole('group', {
      name: fr('pro-manager', 'presence.menu.label', { stylist_name: 'Sam' }),
    })
    .getByRole('button', { name: fr('pro-manager', 'presence.menu.absent') })
    .click();
  const dialog = managerPage.getByRole('dialog');
  await expect(
    dialog.getByText(fr('pro-manager', 'presence.impact.none'), {
      exact: true,
    }),
  ).toBeVisible();
  // Nothing is written before « Confirmer ».
  const { data: before } = await db
    .from('stylist_presence')
    .select('status')
    .eq('member_id', stylistMemberId);
  expect(before?.some((row) => row.status === 'absent')).toBe(false);
  await dialog
    .getByRole('button', { name: fr('pro-manager', 'presence.confirm') })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('stylist_presence')
        .select('status')
        .eq('member_id', stylistMemberId)
        .eq('salon_id', salonId);
      return data?.map((row) => row.status);
    })
    .toContain('absent');
});

/** Paris wall clock: ISO weekday (Monday = 1), date and minutes since midnight. */
function parisNow() {
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

test('at closing, the manager decides for each client still waiting (DEV-7, S-15)', async ({
  browser,
}) => {
  const now = parisNow();
  // The salon closed 3 minutes ago, today: impossible in the first minutes of the day.
  test.skip(now.minutes < 10, 'too close to midnight in Paris');
  const { salonId, manager } = await readySalon('closing');
  const closesAt = now.minutes - 3;
  const hhmm = `${String(Math.floor(closesAt / 60)).padStart(2, '0')}:${String(closesAt % 60).padStart(2, '0')}`;
  must(
    await db
      .from('opening_hours')
      .update({ opens_at: '00:00', closes_at: hhmm })
      .eq('salon_id', salonId)
      .eq('weekday', now.weekday),
    'closing time',
  );
  must(
    await db
      .from('salons')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', salonId),
    'publish',
  );
  must(
    await db.from('tickets').insert({
      salon_id: salonId,
      service_date: now.date,
      short_code: 'KLMNP',
      tracking_token: `tok-closing-${run}`,
      tracking_short_code: `c${run}`.slice(0, 8).padEnd(8, 'x'),
      display_name: 'Inès',
      channel: 'front_desk',
      planned_duration_minutes: 30,
      queue_rank: 1,
      status: 'waiting',
    }),
    'waiting ticket',
  );

  const page = await browser.newPage();
  await signIn(page, manager, '/dashboard');
  // The helper does not expand ICU plurals: the one-client form, as rendered.
  const box = page.getByRole('region', { name: '1 client attend encore' });
  await expect(box).toBeVisible();
  await expect(box.getByText('Inès')).toBeVisible();
  await box
    .getByRole('button', {
      name: fr('pro-manager', 'end_of_day.closing.serve'),
    })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('tickets')
        .select('status, closing_decision')
        .eq('salon_id', salonId)
        .single();
      return `${data?.status}/${data?.closing_decision}`;
    })
    .toBe('waiting/serve');
  await expect(box).toHaveCount(0);
});

test('the manager sees the new time before changing the stylist (DEV-7, S-13)', async ({
  browser,
}) => {
  const now = parisNow();
  const { salonId, manager, stylistMemberId, managerMemberId } =
    await readySalon('reassign');
  // Two people cut hair today: Sam, and Léa the manager, both available.
  must(
    await db
      .from('salon_members')
      .update({ is_hairdressing: true })
      .eq('id', managerMemberId),
    'manager cuts hair',
  );
  must(
    await db.from('stylist_presence').insert(
      [stylistMemberId, managerMemberId].map((member_id) => ({
        salon_id: salonId,
        member_id,
        service_date: now.date,
        status: 'available',
        status_since: new Date().toISOString(),
      })),
    ),
    'presence',
  );
  must(
    await db
      .from('salons')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', salonId),
    'publish',
  );
  const ticket = must(
    await db
      .from('tickets')
      .insert({
        salon_id: salonId,
        service_date: now.date,
        short_code: 'RSTUV',
        tracking_token: `tok-reassign-${run}`,
        tracking_short_code: `r${run}`.slice(0, 8).padEnd(8, 'y'),
        display_name: 'Nora',
        channel: 'front_desk',
        planned_duration_minutes: 30,
        queue_rank: 1,
        status: 'waiting',
        requested_member_id: stylistMemberId,
        estimated_member_id: stylistMemberId,
      })
      .select('id')
      .single(),
    'waiting ticket',
  );
  if (!ticket) throw new Error('ticket creation failed');

  const page = await browser.newPage();
  await signIn(page, manager, '/dashboard');
  await page.getByRole('button', { name: /Nora/ }).click();
  const panel = page.getByRole('dialog');
  await panel
    .getByRole('button', { name: fr('pro-manager', 'ticket_panel.reassign') })
    .click();
  // Scenario 1: the stylist comes with the client's new time.
  const lea = panel.getByRole('radio', { name: /Léa/ });
  await expect(panel.getByText(/Passage estimé à/)).toBeVisible();
  await lea.check();
  // Nothing written before the confirmation.
  const { data: untouched } = await db
    .from('tickets')
    .select('requested_member_id, reassignment_member_id')
    .eq('id', ticket.id)
    .single();
  expect(untouched?.requested_member_id).toBe(stylistMemberId);
  expect(untouched?.reassignment_member_id).toBeNull();
  await panel
    .getByRole('button', { name: /Confirmer|Envoyer la demande/ })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('tickets')
        .select('requested_member_id, reassignment_member_id')
        .eq('id', ticket.id)
        .single();
      return (
        data?.requested_member_id === managerMemberId ||
        data?.reassignment_member_id === managerMemberId
      );
    })
    .toBe(true);
});
