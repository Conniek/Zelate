import { describe, expect, it } from 'vitest';
import { adminGate } from './admin-gate.ts';

describe('adminGate', () => {
  it('sends a signed-out visitor to sign in', () => {
    expect(
      adminGate({
        signedIn: false,
        access: 'granted',
        hasVerifiedFactor: true,
      }),
    ).toEqual({ action: 'redirect_signin' });
  });

  it('forbids a signed-in user who is not an admin, whatever the factors', () => {
    expect(
      adminGate({ signedIn: true, access: 'none', hasVerifiedFactor: true }),
    ).toEqual({ action: 'forbidden' });
  });

  it('asks an admin without a factor to enrol one', () => {
    expect(
      adminGate({
        signedIn: true,
        access: 'mfa_required',
        hasVerifiedFactor: false,
      }),
    ).toEqual({ action: 'enroll_mfa' });
  });

  it('asks an admin with a factor to verify it', () => {
    expect(
      adminGate({
        signedIn: true,
        access: 'mfa_required',
        hasVerifiedFactor: true,
      }),
    ).toEqual({ action: 'verify_mfa' });
  });

  it('lets a verified admin in', () => {
    expect(
      adminGate({ signedIn: true, access: 'granted', hasVerifiedFactor: true }),
    ).toEqual({ action: 'allow' });
  });
});
