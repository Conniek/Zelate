import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface LocalEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  mailUrl: string;
}

function parse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1]) out[match[1]] = match[2] ?? '';
  }
  return out;
}

/**
 * Keys of the local stack. E2E_* variables win; otherwise they are read from
 * `supabase status` (which needs the function secrets to parse config.toml).
 */
export function localEnv(): LocalEnv {
  const given = {
    apiUrl: process.env.E2E_SUPABASE_URL,
    anonKey: process.env.E2E_ANON_KEY,
    serviceRoleKey: process.env.E2E_SERVICE_ROLE_KEY,
  };
  const mailUrl = process.env.E2E_MAIL_URL ?? 'http://127.0.0.1:54324';
  if (given.apiUrl && given.anonKey && given.serviceRoleKey) {
    return { ...given, mailUrl } as LocalEnv;
  }
  const functionsEnv = fileURLToPath(
    new URL('../../../supabase/functions/.env', import.meta.url),
  );
  let secrets: Record<string, string> = {};
  try {
    secrets = parse(readFileSync(functionsEnv, 'utf8'));
  } catch {
    // The variables are probably already exported.
  }
  const status = parse(
    execFileSync('supabase', ['status', '-o', 'env'], {
      env: { ...process.env, ...secrets },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
  return {
    apiUrl: status.API_URL ?? 'http://127.0.0.1:54321',
    anonKey: status.ANON_KEY ?? '',
    serviceRoleKey: status.SERVICE_ROLE_KEY ?? '',
    mailUrl,
  };
}
