import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.4';
import type { PosterRenderer } from '../../../packages/qr-poster/src/index.ts';
import proManager from '../../../packages/i18n/src/fr/pro-manager.json' with { type: 'json' };

const A4 = { width: 595.28, height: 841.89 };
const poster = proManager.qr.poster;

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

/** Wraps text to a width; the standard PDF fonts only cover WinAnsi (é, à, « » are fine). */
function wrap(
  text: string,
  measure: (s: string) => number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function posterRenderer(): PosterRenderer {
  return {
    async render({ url, salonName }) {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([A4.width, A4.height]);
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const ink = rgb(0.1, 0.1, 0.12);
      const margin = 50;
      const textWidth = A4.width - margin * 2;

      let y = A4.height - 110;
      const centered = (
        text: string,
        font: typeof regular,
        size: number,
        gap: number,
      ) => {
        for (const line of wrap(
          text,
          (s) => font.widthOfTextAtSize(s, size),
          textWidth,
        )) {
          page.drawText(line, {
            x: (A4.width - font.widthOfTextAtSize(line, size)) / 2,
            y,
            size,
            font,
            color: ink,
          });
          y -= size + 6;
        }
        y -= gap;
      };

      centered(fill(poster.welcome, { salon_name: salonName }), bold, 30, 14);
      centered(poster.headline, bold, 22, 30);

      // The QR is drawn as vector squares: sharp at any print size.
      const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
      const count: number = qr.modules.size;
      const quiet = 4;
      const side = 300;
      const cell = side / (count + quiet * 2);
      const left = (A4.width - side) / 2;
      const top = y;
      page.drawRectangle({
        x: left,
        y: top - side,
        width: side,
        height: side,
        color: rgb(1, 1, 1),
      });
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (qr.modules.data[row * count + col]) {
            page.drawRectangle({
              x: left + (col + quiet) * cell,
              y: top - (row + quiet + 1) * cell,
              width: cell + 0.2,
              height: cell + 0.2,
              color: ink,
            });
          }
        }
      }
      y = top - side - 40;

      centered(poster.scan, bold, 18, 12);
      centered(poster.benefit, regular, 16, 12);
      centered(poster.appointment, regular, 16, 12);
      centered(poster.no_install, regular, 14, 0);
      page.drawText(poster.footer, {
        x: (A4.width - bold.widthOfTextAtSize(poster.footer, 14)) / 2,
        y: 40,
        size: 14,
        font: bold,
        color: ink,
      });
      return await pdf.save();
    },
  };
}
