import { devices, expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { fr } from './fr';
import { db, forgetPhone, lateEvening, openSalon, proSignIn } from './seed';

/**
 * DEV-8 « Fini quand » (IMPLEMENTATION_PLAN): a client joins from the app,
 * the stylist calls, the client sees « C'est votre tour », arrives, is served
 * and sees the end; then the same through the poster's QR code, with no
 * account before. Test phones and code: `supabase/config.toml`.
 */
const CLIENT_APP = 'http://localhost:5173';
const CODE = '123456';
// Realtime, or the next read 30 s later (PRD §6).
const LIVE = { timeout: 40_000 };

async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  return context.newPage();
}

/** F-C3 steps 1 to 5, the SMS code included. */
async function join(page: Page, nationalDigits: string, firstName: string) {
  await page.getByRole('radio', { name: /Coupe/ }).check();
  await page
    .getByRole('button', { name: fr('common', 'actions.next') })
    .click();
  await page
    .getByRole('button', { name: fr('common', 'actions.next') })
    .click();
  await page
    .getByRole('button', { name: fr('common', 'actions.next') })
    .click();
  await page
    .getByLabel(fr('client', 'signin.phone.label'))
    .fill(nationalDigits);
  await page
    .getByRole('button', { name: fr('client', 'signin.send_code') })
    .click();
  await page
    .getByLabel(fr('client', 'signin.code.digit_aria', { index: 1 }))
    .click();
  await page.keyboard.type(CODE);
  // A first visit asks the first name (K30).
  const name = page.getByLabel(fr('client', 'signin.first_name.label'));
  const summary = page.getByRole('button', {
    name: fr('client', 'join.confirm'),
  });
  await expect(name.or(summary)).toBeVisible();
  if (await name.isVisible()) {
    await name.fill(firstName);
    await page
      .getByRole('button', { name: fr('common', 'actions.next') })
      .click();
  }
  await summary.click();
  await expect(page).toHaveURL(/\/ticket$/);
}

/** The ticket code shown to the client, as the stylist will type it. */
async function ticketCode(page: Page): Promise<string> {
  const label = page.getByText(fr('client', 'ticket.code.label')).first();
  await expect(label).toBeVisible();
  const code = await page
    .locator('[aria-label^="Code du ticket"]')
    .first()
    .innerText();
  return code.trim();
}

/** C-04 to C-08 on the stylist's phone, checked on the client's screen. */
async function serve(client: Page, stylist: Page, code: string) {
  await stylist
    .getByRole('button', { name: fr('pro-stylist', 'queue.call') })
    .click();
  await expect(
    client.getByRole('heading', { name: fr('client', 'ticket.called.title') }),
  ).toBeVisible(LIVE);

  await stylist
    .getByLabel(
      fr('pro-stylist', 'arrival.char_label', { index: 1, count: 5 }),
      {
        exact: true,
      },
    )
    .click();
  await stylist.keyboard.type(code.toLowerCase());
  await expect(
    client.getByRole('heading', { name: fr('client', 'ticket.arrived.title') }),
  ).toBeVisible(LIVE);

  await stylist
    .getByRole('button', { name: fr('pro-stylist', 'start.open') })
    .click();
  await stylist
    .getByRole('dialog')
    .getByRole('button', { name: fr('pro-stylist', 'start.confirm') })
    .click();
  await stylist
    .getByRole('button', { name: fr('pro-stylist', 'service.complete') })
    .focus();
  await stylist.keyboard.press('Enter');
  await stylist
    .getByRole('dialog')
    .getByRole('button', { name: fr('pro-stylist', 'service.complete') })
    .click();
  await expect(
    client.getByRole('heading', {
      name: fr('client', 'ticket.end.title.completed'),
    }),
  ).toBeVisible(LIVE);
}

test('a client joins from the app and is served (DEV-8, U-04, U-06)', async ({
  browser,
}) => {
  test.skip(lateEvening(), 'queue full before midnight');
  await forgetPhone('33612345678');
  const { slug, stylist } = await openSalon('client-app');

  const stylistPage = await phone(browser);
  await proSignIn(stylistPage, stylist, '/stylist/queue');
  await stylistPage
    .getByRole('button', { name: fr('pro-stylist', 'presence.ready') })
    .click();

  const client = await phone(browser);
  await client.goto(`${CLIENT_APP}/salons/${slug}`);
  await client.getByRole('link', { name: fr('client', 'salon.join') }).click();
  await join(client, '612345678', 'Inès');
  const code = await ticketCode(client);
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  await expect(
    client.getByText(fr('client', 'ticket.stylist.first_available')),
  ).toBeVisible();

  await serve(client, stylistPage, code);
});

test('a client joins through the QR poster without an account and is served (DEV-8, U-05)', async ({
  browser,
}) => {
  test.skip(lateEvening(), 'queue full before midnight');
  await forgetPhone('33612345679');
  const { salonId, qrToken, stylist } = await openSalon('client-qr');

  const stylistPage = await phone(browser);
  await proSignIn(stylistPage, stylist, '/stylist/queue');
  await stylistPage
    .getByRole('button', { name: fr('pro-stylist', 'presence.ready') })
    .click();

  const client = await phone(browser);
  await client.goto(`${CLIENT_APP}/q/${qrToken}`);
  await client
    .getByRole('link', { name: fr('client', 'qr.choice.join_queue') })
    .click();
  await join(client, '612345679', 'Noé');
  const { data } = await db
    .from('tickets')
    .select('channel')
    .eq('salon_id', salonId)
    .single();
  expect(data?.channel).toBe('qr');

  await serve(client, stylistPage, await ticketCode(client));
});
