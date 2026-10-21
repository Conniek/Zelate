import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { localEnv } from './env';
import { fr } from './fr';
import { firstLink, waitForMail } from './mail';
import { totp } from './totp';

const env = localEnv();
const db = createClient(env.apiUrl, env.serviceRoleKey, {
  auth: { persistSession: false },
});

const run = Date.now().toString(36);
const PASSWORD = 'e2e-Password-2026!';
const admin = { email: `admin-${run}@e2e.zelate`, password: PASSWORD };
const manager = { email: `manager-${run}@e2e.zelate`, password: PASSWORD };
const stylistEmail = `stylist-${run}@e2e.zelate`;
const salonName = `Salon E2E ${run}`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

// The geocoder and the company register are third parties: the test does not call them.
async function stubThirdParties(page: Page) {
  await page.route('https://data.geopf.fr/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: CORS,
      json: {
        features: [
          {
            properties: {
              label: '1 Rue de la Paix 75002 Paris',
              name: '1 Rue de la Paix',
              postcode: '75002',
              city: 'Paris',
              citycode: '75102',
            },
            geometry: { coordinates: [2.331, 48.869] },
          },
        ],
      },
    }),
  );
  await page.route('**/functions/v1/verify-siret', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({
          contentType: 'application/json',
          headers: CORS,
          json: { ok: true, data: { result: 'valid' } },
        }),
  );
}

async function signIn(
  page: Page,
  who: { email: string; password: string },
  next: string,
) {
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

test.beforeAll(async () => {
  const { data, error } = await db.auth.admin.createUser({
    email: admin.email,
    password: admin.password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('admin creation failed');
  await db
    .from('profiles')
    .insert({ id: data.user.id, first_name: 'Admin', is_guest: false });
  await db.from('platform_admins').insert({ user_id: data.user.id });
});

test('a manager signs up, the admin approves, the manager sets up and a stylist activates', async ({
  browser,
}) => {
  // 1. S-01: the manager registers the salon.
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await stubThirdParties(managerPage);
  await managerPage.goto('/signup');
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.account.email'), { exact: true })
    .fill(manager.email);
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.account.password'), { exact: true })
    .fill(manager.password);
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'signup.account.create') })
    .click();

  await managerPage
    .getByLabel(fr('pro-manager', 'signup.account.first_name'), { exact: true })
    .fill('Léa');
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.account.last_name'), { exact: true })
    .fill('Martin');
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.salon.name'), { exact: true })
    .fill(salonName);
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.salon.phone'), { exact: true })
    .fill('612345678');
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.salon.address'), { exact: true })
    .fill('1 rue de la Paix Paris');
  await managerPage.getByRole('option', { name: /1 Rue de la Paix/ }).click();
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.salon.siret'), { exact: true })
    .fill('73282932000074');
  await managerPage.keyboard.press('Tab');
  await expect(
    managerPage.getByText(fr('pro-manager', 'signup.salon.siret_valid')),
  ).toBeVisible();
  await managerPage
    .getByRole('button', { name: fr('common', 'actions.next') })
    .click();
  await managerPage
    .getByLabel(fr('pro-manager', 'signup.hairdressing.label'), { exact: true })
    .check();
  await managerPage
    .getByRole('button', { name: fr('common', 'actions.next') })
    .click();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'signup.submit') })
    .click();
  await expect(managerPage).toHaveURL(/\/signup\/pending/);

  // 2. P-01: the admin (with a second factor) approves the file.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin, '/admin/salons');
  await expect(
    adminPage.getByRole('heading', {
      name: fr('pro-manager', 'admin.mfa.enroll_title'),
    }),
  ).toBeVisible();
  const secret = (await adminPage.locator('code').innerText()).trim();
  await adminPage
    .getByLabel(fr('pro-manager', 'admin.mfa.digit_aria', { index: 1 }), {
      exact: true,
    })
    .click();
  await adminPage.keyboard.type(totp(secret));
  // The code form submits itself on the sixth digit.
  await adminPage.getByRole('link', { name: salonName }).click();
  await adminPage
    .getByRole('button', {
      name: fr('pro-manager', 'admin.salon.approve'),
      exact: true,
    })
    .click();
  await expect(
    adminPage.getByText(fr('pro-manager', 'admin.salon.approve_done')),
  ).toBeVisible();

  // 3. S-03, S-05, S-04: the manager configures the salon and invites a stylist.
  await signIn(managerPage, manager, '/dashboard/setup');
  await expect(
    managerPage.getByRole('heading', {
      name: fr('pro-manager', 'setup.page_title'),
    }),
  ).toBeVisible();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'hours.add_range') })
    .first()
    .click();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'hours.copy_to_week') })
    .click();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'hours.save') })
    .click();
  await expect(
    managerPage.getByText(fr('pro-manager', 'hours.saved')),
  ).toBeVisible();

  await managerPage
    .getByLabel(fr('pro-manager', 'services.suggestions.beard'), {
      exact: true,
    })
    .check();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'services.suggested_add') })
    .click();
  await expect(
    managerPage.getByText(fr('pro-manager', 'setup.checklist.active_service')),
  ).toBeVisible();

  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'team.add') })
    .click();
  await managerPage
    .getByLabel(fr('pro-manager', 'team.form.first_name'), { exact: true })
    .fill('Sam');
  await managerPage
    .getByLabel(fr('pro-manager', 'team.form.last_name'), { exact: true })
    .fill('Durand');
  await managerPage
    .getByLabel(fr('pro-manager', 'team.form.email'), { exact: true })
    .fill(stylistEmail);
  await managerPage
    .getByLabel(fr('common', 'specialties.beard'), { exact: true })
    .check();
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'team.form.submit') })
    .click();
  await expect(
    managerPage.getByText(
      fr('pro-manager', 'team.invite_sent', { email: stylistEmail }),
    ),
  ).toBeVisible();

  // 4. S-06: the poster downloads as a PDF.
  const download = managerPage.waitForEvent('download');
  await managerPage
    .getByRole('button', { name: fr('pro-manager', 'qr.download') })
    .click();
  const pdf = await (await download).createReadStream();
  const head: Buffer[] = [];
  for await (const chunk of pdf) head.push(chunk as Buffer);
  expect(Buffer.concat(head).subarray(0, 5).toString()).toBe('%PDF-');

  // 5. C-01: the stylist opens the invitation and activates the account.
  const invitation = await waitForMail(env.mailUrl, stylistEmail);
  const stylistContext = await browser.newContext();
  const stylistPage = await stylistContext.newPage();
  await stylistPage.goto(firstLink(invitation));
  await stylistPage
    .getByRole('button', { name: fr('pro-stylist', 'invite.activate_button') })
    .click();
  await expect(
    stylistPage.getByText(fr('pro-stylist', 'invite.check_email')),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const { data } = await db
        .from('salon_members')
        .select('status')
        .eq('email', stylistEmail)
        .maybeSingle();
      return data?.status;
    })
    .toBe('active');
  const signInMail = await waitForMail(env.mailUrl, stylistEmail);
  expect(signInMail).toContain('http');
});
