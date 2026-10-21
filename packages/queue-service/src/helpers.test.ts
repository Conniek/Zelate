import { describe, expect, it } from 'vitest';
import { cryptoRandom, hmacPhoneHasher } from './random.ts';
import { COMMAND_NAMES, parseRequest } from './request.ts';
import {
  addDays,
  isoWeekday,
  parisDate,
  parisInstant,
  parisTime,
  serviceDayOf,
} from './time.ts';

describe('Paris time (ADR-010)', () => {
  it('gives the Paris date, not the UTC one, around midnight', () => {
    // 23:30 UTC on 19/10 is 01:30 on 20/10 in Paris (UTC+2).
    expect(parisDate(Date.UTC(2026, 9, 19, 23, 30))).toBe('2026-10-20');
    expect(parisDate(Date.UTC(2026, 9, 19, 21, 59))).toBe('2026-10-19');
    expect(parisTime(Date.UTC(2026, 9, 19, 8, 5))).toBe('10:05');
  });

  it('places a wall-clock time with the right offset in summer and winter', () => {
    expect(parisInstant('2026-10-19', '09:00')).toBe(
      Date.UTC(2026, 9, 19, 7, 0),
    );
    expect(parisInstant('2026-12-01', '09:00:00')).toBe(
      Date.UTC(2026, 11, 1, 8, 0),
    );
  });

  it('handles both daylight-saving days of 2026', () => {
    // 29/03: 02:00 → 03:00. Opening at 09:00 is already UTC+2.
    expect(parisInstant('2026-03-29', '09:00')).toBe(
      Date.UTC(2026, 2, 29, 7, 0),
    );
    expect(parisInstant('2026-03-29', '01:00')).toBe(
      Date.UTC(2026, 2, 29, 0, 0),
    );
    // 25/10: 03:00 → 02:00. Opening at 09:00 is UTC+1 again.
    expect(parisInstant('2026-10-25', '09:00')).toBe(
      Date.UTC(2026, 9, 25, 8, 0),
    );
    // The service day of 25/10 lasts 25 hours.
    const day = serviceDayOf('2026-10-25', [], false);
    expect(day.ends_at - parisInstant('2026-10-25', '00:00')).toBe(
      25 * 3600_000,
    );
  });

  it('reads Postgres 24:00:00 as the next midnight', () => {
    expect(parisInstant('2026-10-19', '24:00:00')).toBe(
      parisInstant('2026-10-20', '00:00'),
    );
  });

  it('numbers weekdays like opening_hours (Monday 1, Sunday 7)', () => {
    expect(isoWeekday('2026-10-19')).toBe(1);
    expect(isoWeekday('2026-10-25')).toBe(7);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('builds the service day, with no range on a closure day', () => {
    const hours = [
      { opens_at: '09:00:00', closes_at: '12:00:00' },
      { opens_at: '14:00:00', closes_at: '19:00:00' },
    ];
    const open = serviceDayOf('2026-10-19', hours, false);
    expect(open.opening_ranges).toEqual([
      {
        opens_at: Date.UTC(2026, 9, 19, 7),
        closes_at: Date.UTC(2026, 9, 19, 10),
      },
      {
        opens_at: Date.UTC(2026, 9, 19, 12),
        closes_at: Date.UTC(2026, 9, 19, 17),
      },
    ]);
    expect(open.ends_at).toBe(Date.UTC(2026, 9, 19, 22));
    expect(serviceDayOf('2026-10-19', hours, true).opening_ranges).toEqual([]);
  });
});

describe('random values and phone hash', () => {
  it('draws codes in the formats the database checks', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(cryptoRandom.shortCode()).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
      expect(cryptoRandom.trackingShortCode()).toMatch(/^[A-Za-z0-9]{8}$/);
    }
    expect(cryptoRandom.trackingToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cryptoRandom.uuid()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('hashes a number with HMAC-SHA256, the same way every time', async () => {
    const phones = hmacPhoneHasher('x'.repeat(32));
    const a = await phones.hash('+33612345678');
    expect(a).toHaveLength(32);
    expect(await phones.hash('+33612345678')).toEqual(a);
    expect(await phones.hash('+33612345679')).not.toEqual(a);
    const other = hmacPhoneHasher('y'.repeat(32));
    expect(await other.hash('+33612345678')).not.toEqual(a);
  });

  it('refuses a short secret', () => {
    expect(() => hmacPhoneHasher('short')).toThrow(/32/);
  });
});

const ID = '0a6f2a3e-1b2c-4d5e-8f90-123456789abc';
const body = (command: string, payload: unknown, extra = {}) => ({
  command,
  command_id: ID,
  payload,
  ...extra,
});

describe('request validation (TRD §6.2)', () => {
  it('covers the 27 commands of the TRD', () => {
    expect(COMMAND_NAMES).toHaveLength(27);
  });

  it.each([
    null,
    [],
    'text',
    { command: 'drop_table', command_id: ID },
    { command: 'call_ticket', command_id: 'not-a-uuid' },
    { command: 'call_ticket', command_id: ID, payload: [] },
    { command: 'call_ticket', command_id: ID, tracking_token: 'a b' },
    { command: 'call_ticket', command_id: ID, tracking_token: 42 },
  ])('rejects a malformed body %#', (input) => {
    expect(parseRequest(input)).toBeNull();
  });

  it('lower-cases ids and trims names', () => {
    const parsed = parseRequest(
      body('register_walk_in', {
        first_name: '  Léa ',
        phone: '06 12 34 56 78',
        service_id: ID.toUpperCase(),
      }),
    );
    expect(parsed?.payload).toEqual({
      first_name: 'Léa',
      phone: '06 12 34 56 78',
      service_id: ID,
      requested_member_id: null,
    });
  });

  it('reads « je ne sais pas encore » and defaults the consent to false', () => {
    const parsed = parseRequest(
      body('join_queue', {
        salon_id: ID,
        unknown_service: true,
        service_id: ID,
        channel: 'qr',
      }),
    );
    expect(parsed?.payload).toMatchObject({
      service_id: null,
      notifications_consent: false,
      first_name: null,
    });
  });

  it('requires a time zone on instants', () => {
    const ok = parseRequest(
      body('create_appointment', {
        first_name: 'Léa',
        scheduled_at: '2026-10-19T14:30:00+02:00',
        member_id: ID,
      }),
    );
    expect(ok?.payload).toMatchObject({
      scheduled_at: Date.UTC(2026, 9, 19, 12, 30),
      phone: null,
    });
    expect(
      parseRequest(
        body('create_appointment', {
          first_name: 'Léa',
          scheduled_at: '2026-10-19T14:30:00',
          member_id: ID,
        }),
      ),
    ).toBeNull();
    expect(
      parseRequest(
        body('create_appointment', {
          first_name: 'Léa',
          scheduled_at: '2026-13-45T99:00:00Z',
          member_id: ID,
        }),
      ),
    ).toBeNull();
  });

  it('keeps an explicit null service apart from a missing one', () => {
    const cleared = parseRequest(
      body('update_appointment', { ticket_id: ID, service_id: null }),
    );
    expect(cleared?.payload).toEqual({ ticket_id: ID, service_id: null });
    const untouched = parseRequest(
      body('update_appointment', { ticket_id: ID }),
    );
    expect(untouched?.payload).toEqual({ ticket_id: ID });
    const full = parseRequest(
      body('update_appointment', {
        ticket_id: ID,
        scheduled_at: '2026-10-19T15:00:00Z',
        member_id: ID,
        first_name: 'Léo',
        phone: '0612345678',
      }),
    );
    expect(full?.payload).toMatchObject({ first_name: 'Léo', member_id: ID });
  });

  it('requires a reason to refuse an appointment (E29)', () => {
    expect(
      parseRequest(
        body('confirm_appointment', { ticket_id: ID, decision: 'reject' }),
      ),
    ).toBeNull();
    expect(
      parseRequest(
        body('confirm_appointment', {
          ticket_id: ID,
          decision: 'reject',
          reason_code: 'duplicate',
        }),
      )?.payload,
    ).toEqual({ ticket_id: ID, decision: 'reject', reason_code: 'duplicate' });
    expect(
      parseRequest(
        body('confirm_appointment', {
          ticket_id: ID,
          decision: 'confirm',
          member_id: ID,
          merge_into_ticket_id: ID,
        }),
      )?.payload,
    ).toMatchObject({ member_id: ID, merge_into_ticket_id: ID });
  });

  it.each([
    [
      'check_in_appointment',
      { salon_id: ID, qr_token: 'q', scheduled_time: '25:00' },
    ],
    ['adjust_duration', { ticket_id: ID, delta_minutes: 10 }],
    ['start_service', { ticket_id: ID, planned_duration_minutes: 300 }],
    ['remove_ticket', { ticket_id: ID, reason_code: 'bored' }],
    [
      'remove_ticket',
      { ticket_id: ID, reason_code: 'other', note: 'x'.repeat(201) },
    ],
    ['resolve_closing', { ticket_ids: [], decision: 'serve' }],
    ['resolve_closing', { ticket_ids: ['nope'], decision: 'serve' }],
    ['set_presence', { member_id: ID, status: 'sleeping' }],
    ['set_notifications_consent', { ticket_id: ID, consent: 'yes' }],
    [
      'join_queue',
      { salon_id: ID, channel: 'app', first_name: 'x'.repeat(31) },
    ],
    ['respond_eta', { ticket_id: ID, response: 'late', delay_minutes: 7.5 }],
    ['register_walk_in', { first_name: 'Léa', phone: 612345678 }],
  ])('rejects an invalid %s payload', (command, payload) => {
    expect(parseRequest(body(command, payload))).toBeNull();
  });

  it('parses the remaining payloads', () => {
    const cases: [string, unknown][] = [
      [
        'check_in_appointment',
        { salon_id: ID, qr_token: 'q', scheduled_time: '14:30' },
      ],
      ['respond_eta', { ticket_id: ID, response: 'late', delay_minutes: 15 }],
      ['cancel_ticket', { ticket_id: ID }],
      ['cancel_appointment', { ticket_id: ID, reason_code: 'emergency' }],
      ['resolve_stylist_change', { ticket_id: ID, choice: 'wait' }],
      ['respond_end_of_day', { ticket_id: ID, choice: 'stay' }],
      ['set_notifications_consent', { ticket_id: ID, consent: true }],
      ['confirm_arrival', { short_code: 'ab2cd' }],
      ['call_ticket', undefined],
      [
        'start_service',
        { ticket_id: ID, service_id: ID, planned_duration_minutes: 30 },
      ],
      ['adjust_duration', { ticket_id: ID, delta_minutes: 15 }],
      ['complete_service', { ticket_id: ID }],
      ['take_next', { ticket_id: ID }],
      ['remove_ticket', { ticket_id: ID, reason_code: 'other', note: 'Parti' }],
      ['reassign_ticket', { ticket_id: ID, member_id: ID }],
      ['respond_reassignment', { ticket_id: ID, choice: 'accept' }],
      [
        'set_presence',
        {
          member_id: ID,
          status: 'on_break',
          break_type: 'meal',
          until: '2026-10-19T13:00:00+02:00',
        },
      ],
      ['set_hairdressing', { is_hairdressing: false }],
      ['set_queue_status', { salon_id: ID, status: 'paused' }],
      ['resolve_closing', { ticket_ids: [ID, ID], decision: 'serve' }],
      ['create_test_ticket', { salon_id: ID }],
      ['publish_salon', { salon_id: ID }],
    ];
    for (const [command, payload] of cases) {
      expect(parseRequest(body(command, payload)), command).not.toBeNull();
    }
    expect(
      parseRequest(body('confirm_arrival', { short_code: 'ab2cd' }))?.payload,
    ).toEqual({ short_code: 'AB2CD' });
    expect(
      parseRequest(
        body('resolve_closing', { ticket_ids: [ID, ID], decision: 'serve' }),
      )?.payload,
    ).toEqual({ ticket_ids: [ID], decision: 'serve' });
    expect(
      parseRequest(
        body(
          'cancel_ticket',
          { ticket_id: ID },
          { tracking_token: 'a'.repeat(43) },
        ),
      )?.tracking_token,
    ).toBe('a'.repeat(43));
  });
});
