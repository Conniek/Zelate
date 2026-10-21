import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendCommand } from './queue-api';
import type { CommandOutcome } from './queue-api';
import { queryKeys } from './stylist';

/** `errors.queue.unknown_code` → text of the `errors` dictionary. */
export function useErrorText() {
  const { t } = useTranslation('errors');
  return useCallback(
    (messageKey: string) => {
      const key = messageKey.replace(/^errors\./, '');
      const text = t(key as 'generic.unexpected', { defaultValue: '' });
      return text === '' ? t('generic.unexpected') : text;
    },
    [t],
  );
}

/** One queue command at a time; re-reads the queue after it, shows the refusal. */
export function useCommand() {
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (
      command: string,
      payload: Record<string, unknown> = {},
      salonId?: string,
    ): Promise<CommandOutcome> => {
      setBusy(command);
      setError(null);
      const outcome = await sendCommand(
        command,
        payload,
        salonId ? { salonId } : {},
      );
      setBusy(null);
      if (!outcome.ok) setError(errorText(outcome.messageKey));
      // Success or refusal: the queue may have moved in the meantime.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.queue }),
        queryClient.invalidateQueries({ queryKey: queryKeys.context }),
      ]);
      return outcome;
    },
    [errorText, queryClient],
  );

  return { run, busy, error, setError };
}
