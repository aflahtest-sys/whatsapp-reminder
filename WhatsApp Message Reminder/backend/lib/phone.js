'use strict';

// Every ITU country calling code, longest first so that "968" is matched before "96"
// would ever be considered. Used to prove a number actually carries a country code
// instead of being a bare local number that would silently reach a stranger.
const CALLING_CODES = [
  '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44',
  '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61',
  '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95',
  '98', '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226',
  '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239',
  '240', '241', '242', '243', '244', '245', '246', '248', '249', '250', '251', '252', '253',
  '254', '255', '256', '257', '258', '260', '261', '262', '263', '264', '265', '266', '267',
  '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353', '354', '355',
  '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377', '378',
  '380', '381', '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501',
  '502', '503', '504', '505', '506', '507', '508', '509', '590', '591', '592', '593', '594',
  '595', '596', '597', '598', '599', '670', '672', '673', '674', '675', '676', '677', '678',
  '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691', '692',
  '850', '852', '853', '855', '856', '870', '880', '886', '960', '961', '962', '963', '964',
  '965', '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977', '992',
  '993', '994', '995', '996', '998',
].sort((a, b) => b.length - a.length);

const CALLING_CODE_SET = new Set(CALLING_CODES);

/**
 * Reduce anything a human might type into bare digits.
 * Handles "+968 9123 4567", "00968-91234567", "(968) 9123-4567".
 */
function normalizePhone(input) {
  let digits = String(input == null ? '' : input).replace(/\D/g, '');
  // "00" is the international dialling prefix in most of the world; it is not
  // part of the number itself.
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

function findCallingCode(digits) {
  for (const code of CALLING_CODES) {
    if (digits.startsWith(code)) return code;
  }
  return null;
}

/**
 * Validate and canonicalise a phone number for WhatsApp.
 *
 * WhatsApp addresses are "<country code><national number>@c.us" with no plus sign
 * and no leading zero. A number missing its country code does not fail loudly --
 * it quietly reaches a completely different person -- so we refuse to guess unless
 * a default country code is supplied.
 *
 * @returns {{ok: true, phone: string, countryCode: string, assumedCountry: boolean}
 *          | {ok: false, error: string}}
 */
// A bare national number is short; anything this long has to already carry its
// country code. Below the threshold we never guess from the leading digits,
// because almost every digit string starts with *some* valid calling code --
// "91234567" is a normal Omani mobile, but it also looks like +91 (India).
const MIN_INTERNATIONAL_LENGTH = 11;

function parsePhone(input, defaultCountryCode = '') {
  const raw = String(input == null ? '' : input).trim();
  if (!raw) return { ok: false, error: 'Phone number is required' };

  // A leading "+" or "00" is the user explicitly saying "this is international".
  const explicitlyInternational = raw.startsWith('+') || normalizePhone(raw) !== raw.replace(/\D/g, '');
  let digits = normalizePhone(raw);

  if (!digits) return { ok: false, error: 'Phone number must contain digits' };

  let assumedCountry = false;

  if (!explicitlyInternational) {
    // No "+" and no "00": work out whether the country code is already there.
    const national = digits.replace(/^0+/, ''); // drop any trunk prefix
    if (!national) return { ok: false, error: 'Phone number must contain digits' };

    const startsWithDefault =
      defaultCountryCode &&
      national.startsWith(defaultCountryCode) &&
      national.length >= defaultCountryCode.length + 6;

    const longEnoughToCarryACode =
      national.length >= MIN_INTERNATIONAL_LENGTH && Boolean(findCallingCode(national));

    if (startsWithDefault || longEnoughToCarryACode) {
      digits = national;
    } else if (defaultCountryCode) {
      digits = defaultCountryCode + national;
      assumedCountry = true;
    } else {
      return {
        ok: false,
        error:
          'Include the country code, e.g. +968 91234567. Without it the message ' +
          'reaches a different person rather than failing.',
      };
    }
  }

  const code = findCallingCode(digits);

  if (digits.startsWith('0')) {
    return {
      ok: false,
      error: 'Phone number must start with a country code, not 0 (e.g. 96891234567)',
    };
  }

  if (!code) {
    return {
      ok: false,
      error: `"${raw}" does not start with a recognised country code (e.g. 968 for Oman, 971 for UAE)`,
    };
  }

  // E.164 allows at most 15 digits in total. Anything under 8 cannot be a real
  // mobile number with a country code in front of it.
  if (digits.length < 8) {
    return { ok: false, error: 'Phone number is too short to be valid' };
  }
  if (digits.length > 15) {
    return { ok: false, error: 'Phone number is too long (maximum 15 digits)' };
  }

  const national = digits.slice(code.length);
  if (national.length < 5) {
    return { ok: false, error: 'Phone number is missing digits after the country code' };
  }

  return { ok: true, phone: digits, countryCode: code, assumedCountry };
}

/** Pretty form for display: +968 91234567 */
function formatPhone(digits) {
  const code = findCallingCode(String(digits || ''));
  if (!code) return `+${digits}`;
  return `+${code} ${String(digits).slice(code.length)}`;
}

/** The chat id whatsapp-web.js expects. */
function toWhatsAppId(digits) {
  return `${digits}@c.us`;
}

module.exports = {
  CALLING_CODES,
  CALLING_CODE_SET,
  normalizePhone,
  parsePhone,
  formatPhone,
  findCallingCode,
  toWhatsAppId,
};
