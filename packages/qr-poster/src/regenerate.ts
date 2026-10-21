export type QrErrorCode = 'queue.forbidden' | 'queue.invalid_payload';

export class QrError extends Error {
  constructor(readonly code: QrErrorCode) {
    super(code);
  }
}

export interface QrSalon {
  salonId: string;
  salonName: string;
  qrToken: string;
}

export interface QrStore {
  /** Rejects with QrError('queue.forbidden') unless the caller manages a salon. */
  rotate(managerId: string, rotate: boolean): Promise<QrSalon>;
}

export interface PosterRenderer {
  /** A4 PDF whose QR code opens `url`. */
  render(input: { url: string; salonName: string }): Promise<Uint8Array>;
}

export interface PosterStorage {
  /** Replaces the salon's poster. */
  put(salonId: string, pdf: Uint8Array): Promise<void>;
}

export type QrResponse =
  | { status: 200; body: { ok: true; data: { path: string } } }
  | {
      status: 403 | 500;
      body: { ok: false; error: { code: string; messageKey: string } };
    };

export function posterPath(salonId: string): string {
  return `${salonId}/poster.pdf`;
}

export function qrUrl(clientAppUrl: string, qrToken: string): string {
  return `${clientAppUrl.replace(/\/$/, '')}/q/${qrToken}`;
}

export interface QrDeps {
  store: QrStore;
  renderer: PosterRenderer;
  storage: PosterStorage;
  clientAppUrl: string;
}

/**
 * S-06 scenarios 1 and 3. The token is rotated first: if the PDF then fails, the
 * old poster is already dead, so the manager must see the error and retry
 * (a retry with rotate = false rebuilds the PDF for the current token).
 */
export async function regenerateQr(
  deps: QrDeps,
  managerId: string,
  rotate: boolean,
): Promise<QrResponse> {
  try {
    const salon = await deps.store.rotate(managerId, rotate);
    const pdf = await deps.renderer.render({
      url: qrUrl(deps.clientAppUrl, salon.qrToken),
      salonName: salon.salonName,
    });
    await deps.storage.put(salon.salonId, pdf);
    return {
      status: 200,
      body: { ok: true, data: { path: posterPath(salon.salonId) } },
    };
  } catch (error) {
    if (error instanceof QrError) {
      return {
        status: 403,
        body: {
          ok: false,
          error: { code: error.code, messageKey: `errors.${error.code}` },
        },
      };
    }
    return {
      status: 500,
      body: {
        ok: false,
        error: {
          code: 'generic.unexpected',
          messageKey: 'errors.generic.unexpected',
        },
      },
    };
  }
}
