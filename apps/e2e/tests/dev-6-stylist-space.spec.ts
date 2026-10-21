import { createClient } from '@supabase/supabase-js';
import { devices, expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { localEnv } from './env';
import { fr } from './fr';

/**
 * DEV-6 « Fini quand » (IMPLEMENTATION_PLAN): the manager creates a test
 * ticket, the stylist calls it from a phone, types the code, starts, adjusts
 * and completes; nothing about the client stays in the browser after sign-out;
 * S-07 publishes the salon. Then S-16 seen from the stylist's phone.
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
  if (!stylistMember) throw new Error('member creation failed');
  return {
    salonId: salon.id as string,
    manager,
    stylist,
    stylistMemberId: stylistMember.id as string,
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

/** The stylist uses his own phone (ADR-007). */
async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  return context.newPage();
}

/** Everything a page could have kept on the device. */
async function deviceStorage(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const databases =
      'databases' in indexedDB
        ? (await indexedDB.databases()).map((d) => d.name)
        : [];
    const cacheNames = 'caches' in window ? await caches.keys() : [];
    return JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      databases,
      cacheNames,
    });
  });
}

test('test ticket called, served and published from a phone (DEV-6, S-07)', async ({
  browser,
}) => {
  const { salonId, manager, stylist } = await readySalon('loop');

  // S-07: the manager starts the test.
  const managerPage = await browser.newPage();
  await signIn(managerPage, manager, '/dashboard/setup');
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'setup.test.start') })
    .click();
  let code = '';
  let ticketId = '';
  await expect
    .poll(async () => {
      const { data } = await db
        .from('tickets')
        .select('id, short_code')
        .eq('salon_id', salonId)
        .eq('is_test', true)
        .maybeSingle();
      code = data?.short_code ?? '';
      ticketId = data?.id ?? '';
      return code;
    })
    .not.toBe('');
  await expect(managerPage.getByText(code, { exact: true })).toBeVisible();

  // C-02 to C-08 on the stylist's phone.
  const page = await phone(browser);
  await signIn(page, stylist, '/stylist/queue');
  await page
    .getByRole('button', { name: fr('pro-stylist', 'presence.ready') })
    .click();
  await page
    .getByRole('button', { name: fr('pro-stylist', 'queue.call') })
    .click();
  await expect(
    page.getByRole('heading', { name: fr('pro-stylist', 'call.title') }),
  ).toBeVisible();
  await page
    .getByLabel(
      fr('pro-stylist', 'arrival.char_label', { index: 1, count: 5 }),
      { exact: true },
    )
    .click();
  await page.keyboard.type(code.toLowerCase());
  await expect(
    page.getByText(fr('pro-stylist', 'arrival.arrived'), { exact: true }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: fr('pro-stylist', 'start.open') })
    .click();
  const startSheet = page.getByRole('dialog', {
    name: fr('pro-stylist', 'start.sheet_title'),
  });
  await startSheet
    .getByRole('button', { name: fr('pro-stylist', 'start.confirm') })
    .click();
  await expect(
    page.getByRole('heading', {
      name: fr('pro-stylist', 'service.in_progress'),
    }),
  ).toBeVisible();

  await page
    .getByRole('button', {
      name: fr('pro-stylist', 'service.adjust_label', { minutes: 15 }),
    })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('tickets')
        .select('planned_duration_minutes')
        .eq('id', ticketId)
        .single();
      return data?.planned_duration_minutes;
    })
    .toBe(45);

  // « Terminer »: keyboard users confirm in a dialog (DESIGN_SYSTEM §7.1).
  await page
    .getByRole('button', { name: fr('pro-stylist', 'service.complete') })
    .focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog');
  await confirm
    .getByRole('button', { name: fr('pro-stylist', 'service.complete') })
    .click();
  await expect(page.getByText(fr('pro-stylist', 'queue.empty'))).toBeVisible();

  // ADR-007: no client data in the browser, signed in or not.
  expect(await deviceStorage(page)).not.toContain(code);
  await page
    .getByRole('button', { name: fr('common', 'actions.sign_out') })
    .click();
  await expect(page).toHaveURL(/\/signin/);
  const stored = await deviceStorage(page);
  expect(stored).not.toContain(code);
  expect(stored).not.toContain(ticketId);
  expect(JSON.parse(stored).cacheNames).toEqual([]);

  // S-07: test passed, the manager publishes.
  await managerPage.reload();
  await expect(
    managerPage.getByText(fr('pro-manager', 'setup.test.passed')),
  ).toBeVisible();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'setup.publish') })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('salons')
        .select('status')
        .eq('id', salonId)
        .single();
      return data?.status;
    })
    .toBe('published');
});

test('a manager cuts the sessions, then deactivates the stylist (S-16)', async ({
  browser,
}) => {
  const { manager, stylist } = await readySalon('revoke');
  const managerPage = await browser.newPage();
  await signIn(managerPage, manager, '/dashboard/setup');

  const page = await phone(browser);
  await signIn(page, stylist, '/stylist/queue');
  await expect(
    page.getByRole('button', { name: fr('pro-stylist', 'queue.call') }),
  ).toBeVisible();

  // Scenario 1: devices disconnected, the stylist stays active.
  await managerPage
    .getByRole('button', {
      name: fr('pro-manager', 'team.menu.revoke_sessions'),
    })
    .click();
  await managerPage
    .getByRole('dialog')
    .getByRole('button', {
      name: fr('pro-manager', 'team.revoke_sessions.submit'),
    })
    .click();
  await expect(
    page.getByText(fr('pro-stylist', 'signin.sessions_revoked')),
  ).toBeVisible({
    timeout: 30_000,
  });

  // Scenario 3 then 4: back in, then deactivated.
  await signIn(page, stylist, '/stylist/queue');
  await expect(
    page.getByRole('button', { name: fr('pro-stylist', 'queue.call') }),
  ).toBeVisible();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'team.menu.deactivate') })
    .click();
  await managerPage
    .getByRole('dialog')
    .getByRole('button', { name: fr('pro-manager', 'team.deactivate.submit') })
    .click();
  await expect(
    page.getByText(fr('pro-stylist', 'signin.access_revoked')),
  ).toBeVisible({
    timeout: 30_000,
  });
});
