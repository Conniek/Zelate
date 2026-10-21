import type { AuthGateway, RateLimiter, SmsProvider } from './ports.ts';

export function memoryLimiter(): RateLimiter & {
  counts: Map<string, number>;
} {
  const counts = new Map<string, number>();
  const id = (bucket: string, key: string) => `${bucket}|${key}`;
  return {
    counts,
    consume(bucket, key, limit) {
      const current = counts.get(id(bucket, key)) ?? 0;
      if (current >= limit) return Promise.resolve(false);
      counts.set(id(bucket, key), current + 1);
      return Promise.resolve(true);
    },
    isLimited(bucket, key, limit) {
      return Promise.resolve((counts.get(id(bucket, key)) ?? 0) >= limit);
    },
  };
}

export function recordingSms(failWith?: Error): SmsProvider & {
  sent: { to: string; text: string }[];
} {
  const sent: { to: string; text: string }[] = [];
  return {
    sent,
    send(to, text) {
      if (failWith) return Promise.reject(failWith);
      sent.push({ to, text });
      return Promise.resolve();
    },
  };
}

/** Auth double that, like the real one, calls the send hook when asked for a code. */
export function fakeAuth(options: {
  onSignIn?: (phone: string) => Promise<'ok' | 'rate_limited' | 'failed'>;
  validCode?: string;
  verifyFails?: boolean;
}): AuthGateway & { verifyCalls: number } {
  const gateway = {
    verifyCalls: 0,
    async signInWithOtp(phone: string) {
      const outcome = (await options.onSignIn?.(phone)) ?? 'ok';
      return outcome === 'ok'
        ? ({ ok: true } as const)
        : ({ ok: false, reason: outcome } as const);
    },
    verifyOtp(_phone: string, token: string) {
      gateway.verifyCalls += 1;
      if (options.verifyFails) {
        return Promise.resolve({ ok: false, reason: 'failed' } as const);
      }
      return Promise.resolve(
        token === options.validCode
          ? ({ ok: true, session: { access_token: 'jwt' } } as const)
          : ({ ok: false, reason: 'invalid_code' } as const),
      );
    },
  };
  return gateway;
}
