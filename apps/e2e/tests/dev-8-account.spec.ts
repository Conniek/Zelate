import { readFile } from 'node:fs/promises';
import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fr } from './fr';
import { db, freeTestPhones, lateEvening, openSalon } from './seed';

/**
 * DEV-8 part 4 (U-13): a client with a place in progress opens his account,
 * renames himself, gives his consent, downloads his data, then deletes his
 * account: the place is cancelled and his ticket names nobody.
 */
const CLIENT_APP = 'http://localhost:5173';
const CODE = '123456';
const PHONE = '639980083';

const next = (page: Page) =>
  page.getByRole('button', { name: fr('common', 'actions.next') }).click();

test('a client manages then deletes his account (DEV-8, U-13)', async ({
  browser,
}) => {
  test.skip(lateEvening(), 'queue full before midnight');
  await freeTestPhones();
  const { salonId, slug } = await openSalon('client-account');
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    acceptDownloads: true,
  });
  const client = await context.newPage();

  // Joins the queue (F-C3), consent left unchecked.
  await client.goto(`${CLIENT_APP}/salons/${slug}/join`);
  await client.getByRole('radio', { name: /Coupe/ }).check();
  await next(client);
  await next(client);
  await next(client);
  await client.getByLabel(fr('client', 'signin.phone.label')).fill(PHONE);
  await client
    .getByRole('button', { name: fr('client', 'signin.send_code') })
    .click();
  const digit = client.getByLabel(
    fr('client', 'signin.code.digit_aria', { index: 1 }),
  );
  await expect(digit).toBeVisible();
  await digit.click();
  await client.keyboard.type(CODE);
  const name = client.getByLabel(fr('client', 'signin.first_name.label'));
  const summary = client.getByRole('button', {
    name: fr('client', 'join.confirm'),
  });
  await expect(name.or(summary)).toBeVisible();
  if (await name.isVisible()) {
    await name.fill('Awa');
    await next(client);
  }
  await summary.click();
  await expect(client).toHaveURL(/\/ticket$/);

  // The account, from the home page.
  await client.goto(`${CLIENT_APP}/`);
  await client
    .getByRole('link', { name: fr('client', 'account.link') })
    .click();
  await expect(client).toHaveURL(/\/account$/);

  // Scenario 3 then 2: 31 characters are refused, « Awa-Marie » is saved.
  const field = client.getByRole('textbox', {
    name: fr('client', 'account.first_name.label'),
  });
  await field.fill('A'.repeat(31));
  await client
    .getByRole('button', { name: fr('client', 'account.first_name.save') })
    .click();
  // Shown under the field (and said by the page's status line).
  await expect(field).toHaveAccessibleDescription(
    new RegExp(fr('errors', 'validation.first_name')),
  );
  await field.fill('Awa-Marie');
  await client
    .getByRole('button', { name: fr('client', 'account.first_name.save') })
    .click();
  await expect
    .poll(async () => {
      const { data } = await db
        .from('tickets')
        .select('client_id')
        .eq('salon_id', salonId)
        .single();
      const { data: profile } = await db
        .from('profiles')
        .select('first_name')
        .eq('id', data!.client_id as string)
        .single();
      return profile?.first_name;
    })
    .toBe('Awa-Marie');

  // Scenarios 6: consent for the place in progress, with its date.
  const consent = client.getByRole('switch', {
    name: fr('legal', 'consent.tracking_notifications.switch'),
  });
  await expect(consent).not.toBeChecked();
  await consent.check();
  await expect(consent).toBeChecked();
  await expect(client.getByText(/^Accordé le /)).toBeVisible();

  // Scenario 8: the file holds my ticket and my number, no token.
  const download = client.waitForEvent('download');
  await client
    .getByRole('button', { name: fr('client', 'account.export') })
    .click();
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file, 'utf8')) as {
    profile: { phone: string; first_name: string };
    tickets: { status: string }[];
  };
  expect(exported.profile).toMatchObject({
    phone: `+33${PHONE}`,
    first_name: 'Awa-Marie',
  });
  expect(exported.tickets.map((t) => t.status)).toEqual(['waiting']);
  expect(JSON.stringify(exported)).not.toMatch(
    /tracking_token|tracking_short_code/,
  );

  // Scenarios 10 and 12 bis: two confirmations, the place is cancelled.
  await client
    .getByRole('button', { name: fr('client', 'account.delete.label') })
    .click();
  await client
    .getByRole('dialog')
    .getByRole('button', { name: fr('client', 'account.delete.continue') })
    .click();
  await client
    .getByRole('dialog')
    .getByRole('button', { name: fr('client', 'account.delete.confirm') })
    .click();
  await expect(
    client.getByRole('heading', { name: fr('client', 'account.delete.done') }),
  ).toBeVisible();

  const { data: ticket } = await db
    .from('tickets')
    .select('status, client_id, display_name')
    .eq('salon_id', salonId)
    .single();
  expect(ticket).toEqual({
    status: 'cancelled',
    client_id: null,
    display_name: 'Client',
  });

  // Scenario 15: signed out, /ticket asks to sign in again.
  await client.goto(`${CLIENT_APP}/ticket`);
  await expect(client).toHaveURL(/\/signin\?next=%2Fticket$/);
});
