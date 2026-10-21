import { expect } from '@playwright/test';

interface Summary {
  messages: { ID: string }[];
}
interface Message {
  Text: string;
}

/** Text of the first e-mail received by an address in the local Mailpit. */
export async function waitForMail(
  mailUrl: string,
  address: string,
): Promise<string> {
  let text = '';
  await expect
    .poll(
      async () => {
        const list = await fetch(
          `${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
        );
        const first = ((await list.json()) as Summary).messages[0];
        if (!first) return false;
        const message = (await (
          await fetch(`${mailUrl}/api/v1/message/${first.ID}`)
        ).json()) as Message;
        text = message.Text;
        return true;
      },
      { message: `no e-mail for ${address}`, timeout: 20_000 },
    )
    .toBe(true);
  return text;
}

export function firstLink(text: string): string {
  const match = /https?:\/\/\S+/.exec(text);
  if (!match) throw new Error('no link in the e-mail');
  return match[0].replace(/[).,]+$/, '');
}
