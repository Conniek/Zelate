/** Final stage shared by commands and time triggers: notifications and their audit events. */
import { diffNotifications } from './notifications.ts';
import { SYSTEM, ticketEvent } from './state.ts';
import type { EngineOutput, QueueEvent, QueueState } from './types.ts';

export function finalize(
  before: QueueState,
  after: QueueState,
  events: readonly QueueEvent[],
): EngineOutput {
  const notifications = diffNotifications(before, after);
  const estimateEvents = notifications
    .filter((n) => n.template === 'estimate_changed')
    .map((n) => ({
      ...ticketEvent(
        SYSTEM,
        'estimate_changed',
        n.ticket_id,
        typeof n.params.reason === 'string' ? n.params.reason : null,
      ),
      previous_start_at:
        typeof n.params.previous_start_at === 'number'
          ? n.params.previous_start_at
          : null,
    }));
  return {
    state: after,
    events: [...events, ...estimateEvents],
    notifications,
  };
}

export function withVersion(state: QueueState, version: number): QueueState {
  return { ...state, salon: { ...state.salon, queue_version: version } };
}
