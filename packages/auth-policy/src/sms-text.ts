// Template of notifications.auth.otp_code.sms (K27): last line lets Android and
// iOS fill the code automatically.
export function otpSmsText(code: string): string {
  return `Zelaté : votre code de connexion est ${code}. Il est valable 5 min. Ne le donnez à personne.\n\n@zelate.fr #${code}`;
}

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€\f';

/** Number of GSM-7 septets, or null when a character needs UCS-2. */
export function gsm7Length(text: string): number | null {
  let length = 0;
  for (const char of text) {
    if (GSM7_BASIC.includes(char)) length += 1;
    else if (GSM7_EXTENDED.includes(char)) length += 2;
    else return null;
  }
  return length;
}
