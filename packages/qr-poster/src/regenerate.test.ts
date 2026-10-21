import { describe, expect, it } from 'vitest';
import {
  QrError,
  posterPath,
  qrUrl,
  regenerateQr,
  type QrDeps,
} from './index.ts';

function setup(overrides: Partial<QrDeps> = {}) {
  const rotations: boolean[] = [];
  const rendered: { url: string; salonName: string }[] = [];
  const stored: { salonId: string; pdf: Uint8Array }[] = [];
  const deps: QrDeps = {
    store: {
      rotate(_manager, rotate) {
        rotations.push(rotate);
        return Promise.resolve({
          salonId: 'salon-1',
          salonName: 'Chez Léa',
          qrToken: rotate ? 'new-token' : 'old-token',
        });
      },
    },
    renderer: {
      render(input) {
        rendered.push(input);
        return Promise.resolve(new Uint8Array([1, 2, 3]));
      },
    },
    storage: {
      put(salonId, pdf) {
        stored.push({ salonId, pdf });
        return Promise.resolve();
      },
    },
    clientAppUrl: 'https://app.test/',
    ...overrides,
  };
  return { deps, rotations, rendered, stored };
}

describe('regenerateQr', () => {
  it('rotates the token and stores a poster for the new QR', async () => {
    const t = setup();
    const response = await regenerateQr(t.deps, 'manager-1', true);
    expect(response).toEqual({
      status: 200,
      body: { ok: true, data: { path: 'salon-1/poster.pdf' } },
    });
    expect(t.rotations).toEqual([true]);
    expect(t.rendered).toEqual([
      { url: 'https://app.test/q/new-token', salonName: 'Chez Léa' },
    ]);
    expect(t.stored).toHaveLength(1);
  });
  it('rebuilds the poster for the current token without rotating', async () => {
    const t = setup();
    await regenerateQr(t.deps, 'manager-1', false);
    expect(t.rotations).toEqual([false]);
    expect(t.rendered[0]?.url).toBe('https://app.test/q/old-token');
  });
  it('refuses a non-manager and renders nothing', async () => {
    const t = setup({
      store: { rotate: () => Promise.reject(new QrError('queue.forbidden')) },
    });
    const response = await regenerateQr(t.deps, 'stylist-1', true);
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: { code: 'queue.forbidden' } });
    expect(t.rendered).toEqual([]);
    expect(t.stored).toEqual([]);
  });
  it('answers generic.unexpected when rendering or storing fails', async () => {
    const renderFails = setup();
    renderFails.deps.renderer = {
      render: () => Promise.reject(new Error('boom')),
    };
    expect((await regenerateQr(renderFails.deps, 'm', true)).status).toBe(500);
    const storeFails = setup();
    storeFails.deps.storage = { put: () => Promise.reject(new Error('boom')) };
    expect((await regenerateQr(storeFails.deps, 'm', true)).status).toBe(500);
  });
  it('builds paths and URLs', () => {
    expect(posterPath('abc')).toBe('abc/poster.pdf');
    expect(qrUrl('https://x.test', 't')).toBe('https://x.test/q/t');
  });
});
