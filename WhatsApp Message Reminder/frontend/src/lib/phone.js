/**
 * Light client-side phone help. The server is the authority -- it runs the full
 * country-code table and its error message is what the user sees on failure.
 * This exists only to give immediate feedback while typing.
 */

const COMMON_CODES = ['968', '971', '966', '974', '973', '965', '967', '20', '91', '44', '1'];

export function digitsOnly(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

export function formatPhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  const code = COMMON_CODES.slice()
    .sort((a, b) => b.length - a.length)
    .find((c) => digits.startsWith(c));
  return code ? `+${code} ${digits.slice(code.length)}` : `+${digits}`;
}

/**
 * A hint, not a verdict. Returns a warning string or null.
 * We never block submission on this -- the server decides.
 */
export function phoneHint(value, defaultCountryCode = '968') {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const digits = digitsOnly(raw);
  if (digits.length < 7) return 'That looks too short for a phone number.';
  if (digits.length > 15) return 'That is longer than any real phone number (max 15 digits).';

  const explicit = raw.startsWith('+') || /^00/.test(raw.replace(/[^\d+]/g, ''));
  if (!explicit && digits.length < 11 && !digits.startsWith(defaultCountryCode)) {
    return `No country code given, so +${defaultCountryCode} will be added: ${formatPhone(
      defaultCountryCode + digits.replace(/^0+/, '')
    )}`;
  }
  return null;
}
