import { TeamError } from '../../../packages/team-invite/src/index.ts';
import type {
  AuthAdmin,
  Mailer,
  TeamErrorCode,
  TeamStore,
} from '../../../packages/team-invite/src/index.ts';
import { toByteaHex } from '../../../packages/team-invite/src/index.ts';
import notifications from '../../../packages/i18n/src/fr/notifications.json' with { type: 'json' };
import nodemailer from 'npm:nodemailer@6.9.16';
import { serviceClient } from './http.ts';

const KNOWN: TeamErrorCode[] = [
  'queue.forbidden',
  'queue.invalid_payload',
  'team.specialty_required',
  'team.email_already_used',
  'team.limit_reached',
  'invite.link_invalid',
];

function rethrow(error: { message: string }): never {
  const code = KNOWN.find((known) => known === error.message);
  throw code ? new TeamError(code) : new Error('database call failed');
}

export function teamStore(): TeamStore {
  const db = serviceClient();
  return {
    async invite(i) {
      const { data, error } = await db.rpc('invite_member', {
        p_manager: i.managerId,
        p_first_name: i.firstName,
        p_last_name: i.lastName,
        p_email: i.email,
        p_specialties: i.specialties,
        p_token_hash: toByteaHex(i.tokenHash),
        p_expires_at: i.expiresAt.toISOString(),
      });
      if (error) rethrow(error);
      const row = data as { member_id: string; salon_name: string };
      return { memberId: row.member_id, salonName: row.salon_name };
    },
    async peek(tokenHash) {
      const { data, error } = await db.rpc('peek_invitation', {
        p_token_hash: toByteaHex(tokenHash),
      });
      if (error) rethrow(error);
      const row = data as {
        email: string;
        first_name: string;
        salon_name: string;
      };
      return {
        email: row.email,
        firstName: row.first_name,
        salonName: row.salon_name,
      };
    },
    async findUserId(email) {
      const { data, error } = await db.rpc('find_auth_user_id', {
        p_email: email,
      });
      if (error) rethrow(error);
      return (data as string | null) ?? null;
    },
    async activate(tokenHash, userId) {
      const { data, error } = await db.rpc('activate_invitation', {
        p_token_hash: toByteaHex(tokenHash),
        p_user_id: userId,
      });
      if (error) rethrow(error);
      return { email: (data as { email: string }).email };
    },
  };
}

export function authAdmin(): AuthAdmin {
  const db = serviceClient();
  return {
    async createUser(email) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error('user creation failed');
      return data.user.id;
    },
    async magicLink(email, redirectTo) {
      const { data, error } = await db.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      });
      if (error || !data.properties?.action_link) {
        throw new Error('link generation failed');
      }
      return data.properties.action_link;
    },
  };
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

/** Local development only: delivers to the Mailpit mailbox of `supabase start`. */
async function sendSmtp(
  host: string,
  from: string,
  to: string,
  subject: string,
  text: string,
) {
  const transport = nodemailer.createTransport({
    host,
    port: Number(Deno.env.get('SMTP_PORT') ?? 1025),
    secure: false,
  });
  await transport.sendMail({ from, to, subject, text });
}

/** Brevo transactional e-mail (TRD §2). Links are never logged. */
export function mailer(): Mailer {
  async function send(to: string, subject: string, text: string) {
    const apiKey = Deno.env.get('BREVO_API_KEY');
    const from = Deno.env.get('MAIL_FROM');
    const smtpHost = Deno.env.get('SMTP_HOST');
    if (!from) throw new Error('mailer not configured');
    if (!apiKey && smtpHost) {
      try {
        await sendSmtp(smtpHost, from, to, subject, text);
      } catch (error) {
        console.error('smtp delivery failed:', String(error));
        throw error;
      }
      return;
    }
    if (!apiKey) throw new Error('mailer not configured');
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: 'Zelaté' },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`mailer failed: ${response.status}`);
  }
  return {
    sendInvitation(mail) {
      const { subject, body } = notifications.member_invitation.email;
      return send(
        mail.to,
        subject,
        fill(body, {
          first_name: mail.firstName,
          salon_name: mail.salonName,
          link: mail.link,
        }),
      );
    },
    sendMagicLink(mail) {
      const { subject, body } = notifications.staff_sign_in.email;
      return send(mail.to, subject, fill(body, { link: mail.link }));
    },
  };
}

export function proAppUrl(): string {
  return (Deno.env.get('PRO_APP_URL') ?? 'http://localhost:5174').replace(
    /\/$/,
    '',
  );
}
