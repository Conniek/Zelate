// PRD §5.3 P-03 and U-03; fixed windows (private.rate_limits.window_start).
export const OTP_CODES_PER_PHONE = 5;
export const OTP_CODES_PER_IP = 20;
export const OTP_WINDOW_SECONDS = 3600;
export const OTP_VERIFY_FAILURES = 3;
export const OTP_VERIFY_WINDOW_SECONDS = 300;

export const BUCKET_SMS_PHONE = 'otp_sms_phone';
export const BUCKET_SMS_IP = 'otp_sms_ip';
export const BUCKET_VERIFY_FAILURES = 'otp_verify_failures';
