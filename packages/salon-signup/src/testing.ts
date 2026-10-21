import type {
  Establishment,
  SignupStore,
  SiretLookup,
  SubmitSalon,
} from './ports.ts';

export const hairSalon: Establishment = {
  siret: '12345678901234',
  administrativeState: 'A',
  naf: '96.02A',
  addressLine: '1 rue de la Paix',
  postalCode: '75002',
  city: 'Paris',
  cityCode: '75102',
  longitude: 2.331,
  latitude: 48.869,
};

export function fakeLookup(
  outcome: Establishment | null | Error,
): SiretLookup & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    find(siret) {
      calls.push(siret);
      if (outcome instanceof Error) return Promise.reject(outcome);
      return Promise.resolve(outcome);
    },
  };
}

export function recordingStore(failWith?: Error): SignupStore & {
  submitted: SubmitSalon[];
} {
  const submitted: SubmitSalon[] = [];
  return {
    submitted,
    submit(salon) {
      if (failWith) return Promise.reject(failWith);
      submitted.push(salon);
      return Promise.resolve('salon-1');
    },
  };
}
