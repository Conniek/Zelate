export interface ClosureInput {
  startsOn: string;
  endsOn: string;
  reason?: string;
}

export type ClosureError =
  'validation.closure_dates' | 'validation.closure_reason_length';

/** S-03 scenarios 8 to 10. ISO dates compare as strings. One day is allowed (ends = starts). */
export function validateClosure(input: ClosureInput): ClosureError | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn) ||
    input.endsOn < input.startsOn
  ) {
    return 'validation.closure_dates';
  }
  if ((input.reason ?? '').length > 120) {
    return 'validation.closure_reason_length';
  }
  return null;
}
