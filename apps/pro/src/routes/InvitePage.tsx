import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Banner, Button } from '@zelate/ui';
import { activateInvitation } from '../lib/team-api';

type State = 'idle' | 'busy' | 'sent' | 'invalid' | 'failed';

export function InvitePage() {
  const { token = '' } = useParams();
  const { t } = useTranslation('pro-stylist');
  const { t: tErrors } = useTranslation('errors');
  const [state, setState] = useState<State>('idle');

  async function activate() {
    if (state === 'busy') return;
    setState('busy');
    const outcome = await activateInvitation(token);
    if (outcome.ok) setState('sent');
    else
      setState(
        outcome.messageKey === 'pro-stylist.invite.link_invalid'
          ? 'invalid'
          : 'failed',
      );
  }

  return (
    <main className="mx-auto grid w-full max-w-md gap-6 px-5 py-10">
      <h1 className="text-h1">{t('invite.title')}</h1>
      {state === 'sent' ? (
        <Banner role="status" tone="success">
          {t('invite.check_email')}
        </Banner>
      ) : state === 'invalid' ? (
        <Banner role="alert" tone="danger">
          {t('invite.link_invalid')}
        </Banner>
      ) : (
        <>
          <p>{t('invite.intro')}</p>
          {state === 'failed' && (
            <Banner role="alert" tone="danger">
              {tErrors('generic.unexpected')}
            </Banner>
          )}
          <Button
            fullWidth
            loading={state === 'busy'}
            onClick={() => void activate()}
            size="lg"
          >
            {t('invite.activate_button')}
          </Button>
        </>
      )}
    </main>
  );
}
