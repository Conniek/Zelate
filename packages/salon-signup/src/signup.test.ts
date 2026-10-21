import { describe, expect, it } from 'vitest';
import { salonSignup, type SignupInput } from './signup.ts';
import { fakeLookup, hairSalon, recordingStore } from './testing.ts';

const input: SignupInput = {
  firstName: ' Léa ',
  salonName: 'Chez Léa',
  phone: '+33142000000',
  addressLine: '1 rue de la Paix',
  postalCode: '75002',
  city: 'Paris',
  longitude: 2.331,
  latitude: 48.869,
  siret: '123 456 789 01234',
  isHairdressing: true,
};

function setup(lookup = fakeLookup(hairSalon), store = recordingStore()) {
  return {
    lookup,
    store,
    run: (i: Partial<SignupInput> = {}) =>
      salonSignup({ lookup, store }, 'user-1', { ...input, ...i }),
  };
}

describe('salonSignup', () => {
  it('creates the salon with the verified SIRET', async () => {
    const s = setup();
    const r = await s.run();
    expect(r).toEqual({
      status: 200,
      body: { ok: true, data: { salonId: 'salon-1', siretCheck: 'valid' } },
    });
    expect(s.store.submitted[0]).toMatchObject({
      userId: 'user-1',
      firstName: 'Léa',
      siret: '12345678901234',
      nafCode: '96.02A',
      cityCode: '75102',
      siretCheckResult: 'valid',
    });
  });

  it.each([
    [{ firstName: ' ' }, 'validation.required', 'firstName'],
    [{ salonName: 'A' }, 'validation.required', 'salonName'],
    [{ phone: '0142000000' }, 'validation.phone_format', 'phone'],
    [{ city: ' ' }, 'validation.required', 'address'],
    [{ postalCode: '7500' }, 'validation.postal_code_format', 'postalCode'],
    [{ latitude: Number.NaN }, 'validation.address_not_selected', 'address'],
    [{ longitude: 300 }, 'validation.address_not_selected', 'address'],
    [{ siret: '123' }, 'validation.siret_format', 'siret'],
  ])('rejects %j', async (patch, code, field) => {
    const s = setup();
    const r = await s.run(patch);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ ok: false, error: { code, field } });
    expect(s.lookup.calls).toEqual([]);
    expect(s.store.submitted).toEqual([]);
  });

  it('still submits when the SIRET is unknown or the service is down', async () => {
    for (const outcome of [null, new Error('down')]) {
      const s = setup(fakeLookup(outcome));
      const r = await s.run();
      expect(r.status).toBe(200);
      expect(s.store.submitted[0]).toMatchObject({ nafCode: '', cityCode: '' });
    }
  });

  it('keeps the city code chosen in the form', async () => {
    const s = setup(fakeLookup(null));
    await s.run({ cityCode: '69123' });
    expect(s.store.submitted[0]?.cityCode).toBe('69123');
  });

  it('answers 500 when the store fails', async () => {
    const r = await setup(undefined, recordingStore(new Error('db'))).run();
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ error: { code: 'generic.unexpected' } });
  });
});
