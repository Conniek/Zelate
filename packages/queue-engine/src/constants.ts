/** Fixed rule values of the pilot (PRD §5.1, §5.2, §5.4). */

export const MINUTE = 60_000;

/** Duration counted when the service is unknown (« je ne sais pas encore », E12). */
export const UNKNOWN_SERVICE_MINUTES = 30;

/** Minimum remaining time `m` of an overrunning service (H2). */
export const OVERRUN_MINIMUM_MINUTES = 5;

/** Displayed waits are rounded up to this step (H2). */
export const WAIT_ROUNDING_MINUTES = 5;

/** In-service adjustments allowed (H2, C-07). */
export const DURATION_DELTAS: readonly number[] = [5, 15, 30, 45];

/** Upper bound of `planned_duration_minutes` (BACKEND_SCHEMA §4.13). */
export const MAX_DURATION_MINUTES = 240;
export const MIN_DURATION_MINUTES = 5;

/** Declared delay bounds (PRD §5.1, U-07). */
export const MIN_DELAY_MINUTES = 5;
export const MAX_DELAY_MINUTES = 30;

/** A ticket moves back at most this many places in total (H5). */
export const MAX_POSTPONE = 2;

/** Without an answer to a stylist change within this delay, the default applies (transition 8). */
export const STYLIST_CHANGE_TIMEOUT_MINUTES = 10;

/** E19: reminder to the salon when a check-in stays unconfirmed. */
export const CONFIRMATION_REMINDER_MINUTES = 10;

/** E23: step of the delay on an appointment, in minutes. */
export const APPOINTMENT_DELAY_STEP_MINUTES = 10;

/** Estimate changes of this size or more are explained (E11). */
export const ESTIMATE_NOTIFY_THRESHOLD_MINUTES = 10;

/** Anticipation thresholds (H3). */
export const TURN_APPROACHING_MINUTES = 30;
export const GET_READY_MINUTES = 10;

/** A new appointment may be up to this late (E26). */
export const PAST_APPOINTMENT_TOLERANCE_MINUTES = 15;

/** E9: a reassignment request lapses after 10 min without an answer. */
export const REASSIGNMENT_TIMEOUT_MINUTES = 10;

/** E27: an acceptance holds while the time does not move back by this much more. */
export const REASSIGNMENT_TOLERANCE_MINUTES = 10;
