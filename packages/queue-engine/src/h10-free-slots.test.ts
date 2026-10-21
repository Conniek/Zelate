/** E22 — next free slots (PRD §5.2, « trou »). */
import { describe, expect, it } from 'vitest';
import { findNextFreeSlots } from './index.ts';
import {
  at,
  inServiceTicket,
  makeMember,
  makeSalon,
  makeState,
  makeTicket,
  presence,
  range,
} from './testing/fixtures.ts';

const slot = (slots: ReturnType<typeof findNextFreeSlots>, serviceId: string) =>
  slots.find((s) => s.service_id === serviceId);

describe('E22 — next free slots', () => {
  it('a free stylist offers a slot right now (rounded up to the minute)', () => {
    const state = makeState({ members: [makeMember('ines')] });
    expect(slot(findNextFreeSlots(state, at('10:00') + 1), 'cut')).toEqual({
      service_id: 'cut',
      start_at: at('10:01'),
      member_id: 'ines',
    });
  });

  it('shows nothing while the queue is not open', () => {
    for (const queue_status of ['closed', 'paused'] as const) {
      const state = makeState({
        salon: makeSalon({ queue_status }),
        members: [makeMember('ines')],
      });
      expect(findNextFreeSlots(state, at('10:00'))).toEqual([]);
    }
  });

  it('the hole starts after the current service and the waiting clients', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [inServiceTicket('x', 'ines', at('09:50')), makeTicket('a')],
    });
    expect(slot(findNextFreeSlots(state, at('10:00')), 'cut')?.start_at).toBe(
      at('10:50'),
    );
  });

  it('a hole between two appointments is offered only if the service fits (margin 0)', () => {
    const rv = (id: string, time: string) =>
      makeTicket(id, {
        kind: 'appointment',
        scheduled_at: at(time),
        appointment_source: 'salon_entry',
        assigned_member_id: 'ines',
      });
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [rv('r1', '10:00'), rv('r2', '11:00')],
    });
    const slots = findNextFreeSlots(state, at('09:00'));
    expect(slot(slots, 'cut')?.start_at).toBe(at('09:00'));
    const later = findNextFreeSlots(state, at('09:45'));
    expect(slot(later, 'men')?.start_at).toBe(at('10:30'));
    const tight = findNextFreeSlots(state, at('09:31'));
    expect(slot(tight, 'cut')?.start_at).toBe(at('10:30'));
  });

  it('only a stylist who masters the service is considered', () => {
    const state = makeState({
      members: [
        makeMember('ines', { specialties: ['men_cut'] }),
        makeMember('karim', { specialties: ['women_cut', 'men_cut'] }),
      ],
      tickets: [inServiceTicket('x', 'karim', at('09:50'))],
    });
    const slots = findNextFreeSlots(state, at('10:00'));
    expect(slot(slots, 'men')?.member_id).toBe('ines');
    expect(slot(slots, 'cut')?.member_id).toBe('karim');
    expect(slot(slots, 'cut')?.start_at).toBeGreaterThan(at('10:00'));
  });

  it('skips breaks and absent stylists, and the lunch closure', () => {
    const state = makeState({
      salon: makeSalon({
        service_day: {
          service_date: '2026-10-21',
          opening_ranges: [range('09:00', '12:00'), range('14:00', '19:00')],
          ends_at: at('23:59'),
        },
      }),
      members: [
        makeMember('ines', {
          presence: presence('on_break', { expected_back_at: at('10:30') }),
        }),
        makeMember('karim', { presence: presence('absent') }),
      ],
    });
    expect(slot(findNextFreeSlots(state, at('10:00')), 'cut')?.start_at).toBe(
      at('10:30'),
    );
    const noon = findNextFreeSlots(
      makeState({ salon: state.salon, members: [makeMember('ines')] }),
      at('12:10'),
    );
    expect(slot(noon, 'cut')?.start_at).toBe(at('14:00'));
  });

  it('a hole must end before closing and before the end of the stylist day', () => {
    const closing = makeState({ members: [makeMember('ines')] });
    expect(
      slot(findNextFreeSlots(closing, at('18:40')), 'cut'),
    ).toBeUndefined();
    expect(slot(findNextFreeSlots(closing, at('18:40')), 'men')?.start_at).toBe(
      at('18:40'),
    );
    const leaving = makeState({
      members: [
        makeMember('ines', {
          presence: presence('off_duty', { shift_end_at: at('12:00') }),
        }),
      ],
    });
    expect(
      slot(findNextFreeSlots(leaving, at('11:45')), 'cut'),
    ).toBeUndefined();
  });

  it('skips inactive services', () => {
    const state = makeState({
      members: [makeMember('ines')],
      services: [
        {
          id: 'cut',
          duration_minutes: 30,
          required_specialty_code: null,
          is_active: false,
        },
      ],
    });
    expect(findNextFreeSlots(state, at('10:00'))).toEqual([]);
  });
});
