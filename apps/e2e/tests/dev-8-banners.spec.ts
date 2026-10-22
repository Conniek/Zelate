import { createClient } from '@supabase/supabase-js';
import { devices, expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { fr } from './fr';
import {
  db,
  env,
  freeTestPhones,
  lateEvening,
  openSalon,
  parisNow,
} from './seed';
import type { Account } from './seed';

/**
 * DEV-8 part 3: a client with an appointment taken elsewhere checks in from
 * the poster (U-14), and a client whose stylist runs late answers the
 * request on his tracking screen (U-12). Staff gestures go straight to
 * `queue-command`: their screens are covered by DEV-6 and DEV-7.
 */
const CLIENT_APP = 'http://localhost:5173';
const CODE = '123456';
const LIVE = { timeout: 20_000 };

async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  return context.newPage();
}

/** A staff member's session, to send commands as he would from Zelaté Pro. */
async function staff(who: Account) {
  const client = createClient(env.apiUrl, env.anonKey, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: who.email,
    password: who.password,
  });
  if (error) throw new Error(`staff sign-in failed: ${error.message}`);
  return async (command: string, payload: Record<string, unknown>) => {
    const { data, error: failed } = await client.functions.invoke(
      'queue-command',
      { body: { command, command_id: crypto.randomUUID(), payload } },
    );
    if (failed || !data?.ok) {
      const context = (failed as { context?: unknown } | null)?.context;
      const body =
        context instanceof Response
          ? await context.text()
          : JSON.stringify(data);
      throw new Error(`${command} failed: ${body}`);
    }
  };
}

async function memberId(salonId: string, profileId: string): Promise<string> {
  const { data } = await db
    .from('salon_members')
    .select('id')
    .eq('salon_id', salonId)
    .eq('profile_id', profileId)
    .single();
  return data!.id as string;
}

async function ticketId(salonId: string): Promise<string> {
  const { data } = await db
    .from('tickets')
    .select('id')
    .eq('salon_id', salonId)
    .single();
  return data!.id as string;
}

const next = (page: Page) =>
  page.getByRole('button', { name: fr('common', 'actions.next') }).click();

/** F-C3 step 4: the SMS code, then the first name of a new account. */
async function identify(page: Page, nationalDigits: string, firstName: string) {
  await page
    .getByLabel(fr('client', 'signin.phone.label'))
    .fill(nationalDigits);
  await page
    .getByRole('button', { name: fr('client', 'signin.send_code') })
    .click();
  const digit = page.getByLabel(
    fr('client', 'signin.code.digit_aria', { index: 1 }),
  );
  await expect(digit).toBeVisible();
  await digit.click();
  await page.keyboard.type(CODE);
  const name = page.getByLabel(fr('client', 'signin.first_name.label'));
  await expect(name.or(page.getByRole('checkbox'))).toBeVisible();
  if (await name.isVisible()) {
    await name.fill(firstName);
    await next(page);
  }
}

test('a client with an appointment checks in from the poster (DEV-8, U-14)', async ({
  browser,
}) => {
  test.skip(lateEvening(), 'no slot left before midnight');
  await freeTestPhones();
  const { salonId, qrToken, stylist } = await openSalon('client-check-in');
  const sam = await memberId(salonId, stylist.id);

  const client = await phone(browser);
  await client.goto(`${CLIENT_APP}/q/${qrToken}`);
  await client
    .getByRole('link', { name: fr('client', 'qr.choice.have_appointment') })
    .click();
  await expect(client).toHaveURL(/\/check-in$/);
  // An appointment in an hour, on the 5-minute grid.
  const at = Math.ceil((parisNow().minutes + 60) / 5) * 5;
  const slot = `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
  await client
    .getByLabel(fr('client', 'check_in.time.choose'))
    .selectOption(slot);
  await next(client);
  await client.getByRole('radio', { name: 'Sam' }).check();
  await next(client);
  await identify(client, '639980081', 'Lina');
  await client
    .getByRole('button', { name: fr('client', 'check_in.confirm') })
    .click();
  await expect(client).toHaveURL(/\/ticket$/);
  await expect(
    client.getByText(fr('client', 'ticket.appointment.pending')),
  ).toBeVisible();

  const asSam = await staff(stylist);
  await asSam('confirm_appointment', {
    ticket_id: await ticketId(salonId),
    decision: 'confirm',
    member_id: sam,
  });
  await expect(client.getByText(/^Rendez-vous à /).first()).toBeVisible(LIVE);
});

test('a client whose stylist is late chooses to wait for him (DEV-8, U-12)', async ({
  browser,
}) => {
  test.skip(lateEvening(), 'queue full before midnight');
  await freeTestPhones();
  const { salonId, slug, manager, stylist } = await openSalon(
    'client-stylist-late',
  );
  const sam = await memberId(salonId, stylist.id);
  const asSam = await staff(stylist);
  await asSam('set_presence', { member_id: sam, status: 'available' });

  const client = await phone(browser);
  await client.goto(`${CLIENT_APP}/salons/${slug}/join`);
  await client.getByRole('radio', { name: /Coupe/ }).check();
  await next(client);
  await client.getByRole('radio', { name: /Sam/ }).check();
  await next(client);
  await next(client);
  await identify(client, '639980082', 'Malo');
  await client
    .getByRole('button', { name: fr('client', 'join.confirm') })
    .click();
  await expect(client).toHaveURL(/\/ticket$/);

  // Late and absent are the manager's to declare (E7).
  await (
    await staff(manager)
  )('set_presence', {
    member_id: sam,
    status: 'late',
    until: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  const banner = client.getByRole('region', {
    name: fr('client', 'ticket.stylist_change.banner'),
  });
  await expect(banner).toBeVisible(LIVE);
  // Late, not absent: « Attendre » stays on offer (E7, E8).
  await banner
    .getByRole('button', {
      name: fr('client', 'ticket.stylist_change.wait', { first_name: 'Sam' }),
    })
    .click();
  await expect(banner).toBeHidden();
  const { data } = await db
    .from('tickets')
    .select('requested_member_id, stylist_change_pending_since')
    .eq('salon_id', salonId)
    .single();
  expect(data).toEqual({
    requested_member_id: sam,
    stylist_change_pending_since: null,
  });
});
