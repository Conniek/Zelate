import { QrError } from '../../../packages/qr-poster/src/index.ts';
import type {
  PosterStorage,
  QrStore,
} from '../../../packages/qr-poster/src/index.ts';
import { posterPath } from '../../../packages/qr-poster/src/index.ts';
import { serviceClient } from './http.ts';

export function qrStore(): QrStore {
  const db = serviceClient();
  return {
    async rotate(managerId, rotate) {
      const { data, error } = await db.rpc('rotate_qr_token', {
        p_manager: managerId,
        p_rotate: rotate,
      });
      if (error) {
        if (error.message === 'queue.forbidden') {
          throw new QrError('queue.forbidden');
        }
        throw new Error('database call failed');
      }
      const row = data as {
        salon_id: string;
        salon_name: string;
        qr_token: string;
      };
      return {
        salonId: row.salon_id,
        salonName: row.salon_name,
        qrToken: row.qr_token,
      };
    },
  };
}

export function posterStorage(): PosterStorage {
  const db = serviceClient();
  return {
    async put(salonId, pdf) {
      const { error } = await db.storage
        .from('qr-posters')
        .upload(posterPath(salonId), pdf, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (error) throw new Error('storage upload failed');
    },
  };
}

export function clientAppUrl(): string {
  return Deno.env.get('CLIENT_APP_URL') ?? 'http://localhost:5173';
}
