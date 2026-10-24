import { expect, test } from '@playwright/test';
import { fr } from './fr';
import { db, lateEvening, must, openSalon, parisNow, run } from './seed';

/**
 * DEV-8 part 2 (U-01, U-16): salons around the client's position, the
 * « Ouvert maintenant » filter and the next free slot with its service.
 */
const CLIENT_APP = 'http://localhost:5173';
// The seeded salons stand at 2.331 E, 48.869 N (seed.ts).
const NEARBY = { latitude: 48.87, longitude: 2.332 };

test('the home lists open salons around me with their next free slot (DEV-8, U-01, U-16)', async ({
  browser,
}) => {
  test.skip(lateEvening(), 'the free slot would fall after midnight');
  const open = await openSalon('home-open');
  const paused = await openSalon('home-paused');
  // Queue left « open », but the salon is closed today (F-C1, F-C2).
  const closed = await openSalon('home-closed');
  const today = parisNow().date;
  must(
    await db
      .from('salon_closures')
      .insert({ salon_id: closed.salonId, starts_on: today, ends_on: today }),
    'closure',
  );
  // Yesterday's figures would still offer a slot: closed, it must not show.
  const { data: closedService } = await db
    .from('services')
    .select('id')
    .eq('salon_id', closed.salonId)
    .single();
  must(
    await db
      .from('salons')
      .update({
        next_free_slots: [
          {
            service_id: closedService!.id,
            start_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          },
        ],
      })
      .eq('id', closed.salonId),
    'stale slot',
  );
  must(
    await db
      .from('salons')
      .update({ queue_status: 'paused' })
      .eq('id', paused.salonId),
    'pause',
  );
  // A free slot as the engine would publish it (ADR-017).
  const { data: service } = await db
    .from('services')
    .select('id')
    .eq('salon_id', open.salonId)
    .single();
  const slot = new Date(Date.now() + 60 * 60_000);
  slot.setUTCSeconds(0, 0);
  must(
    await db
      .from('salons')
      .update({
        next_free_slots: [
          { service_id: service!.id, start_at: slot.toISOString() },
        ],
      })
      .eq('id', open.salonId),
    'free slot',
  );

  // Position already allowed: the list comes straight away (F-C1).
  const context = await browser.newContext({
    geolocation: NEARBY,
    permissions: ['geolocation'],
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  await page.goto(CLIENT_APP);

  const card = page.getByRole('link', {
    name: new RegExp(`Salon home-open ${run}`),
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Créneau libre à \d{1,2}h\d{2} · Coupe/);
  // « Ouvert maintenant » hides the paused queue, unticked it shows it.
  await expect(
    page.getByRole('link', { name: new RegExp(`Salon home-paused ${run}`) }),
  ).toHaveCount(0);
  await page.getByLabel(fr('client', 'home.filters.open_now')).uncheck();
  await expect(
    page.getByRole('link', { name: new RegExp(`Salon home-paused ${run}`) }),
  ).toBeVisible();
  const closedCard = page.getByRole('link', {
    name: new RegExp(`Salon home-closed ${run}`),
  });
  await expect(closedCard).toContainText(
    fr('client', 'home.queue_state.closed'),
  );
  await expect(closedCard).not.toContainText(/Créneau libre/);
  // Its join page sends back to the salon page, which says why.
  await page.goto(`${CLIENT_APP}/salons/${closed.slug}/join`);
  await expect(page).toHaveURL(new RegExp(`/salons/${closed.slug}$`));
  await expect(page.locator('#join-blocked')).toContainText(/^Fermé/);
  await page.goto(CLIENT_APP);
  await page.getByLabel(fr('client', 'home.filters.open_now')).uncheck();

  await card.click();
  await expect(page).toHaveURL(new RegExp(`/salons/${open.slug}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Salon home-open',
  );
});
