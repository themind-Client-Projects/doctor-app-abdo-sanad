/**
 * Normalise an Iraqi mobile number to a single canonical form.
 *
 * `07701234567`, `+9647701234567`, `009647701234567` and `0770 123 4567` are
 * the same subscriber, but stored verbatim they produced DIFFERENT User rows,
 * different OTP records and different rate-limit buckets — so a user could
 * request a code in one format and fail to verify in another.
 *
 * Canonical form: `9647XXXXXXXXX` (country code, no `+`).
 *
 * @returns the canonical number, or null if it isn't a valid Iraqi mobile.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  let national: string;
  if (digits.startsWith("00964")) national = digits.slice(5);
  else if (digits.startsWith("964")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;

  // Iraqi mobiles are 10 national digits beginning 7 (7xx xxx xxxx).
  if (!/^7\d{9}$/.test(national)) return null;

  return `964${national}`;
}
