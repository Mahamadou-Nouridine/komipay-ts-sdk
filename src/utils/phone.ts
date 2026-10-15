import { KomipayValidationError } from '../errors/KomipayError';

/**
 * Calling codes for the markets KomiPay documents. Extend freely — the map is
 * the single source of truth used to build E.164 numbers.
 */
const CALLING_CODES: Record<string, string> = {
  NE: '227',
  BJ: '229',
  TG: '228',
  BF: '226',
  CI: '225',
  ML: '223',
  SN: '221',
  GH: '233',
  NG: '234',
  GM: '220',
  GN: '224',
  LR: '231',
  SL: '232',
  GW: '245',
  MR: '222',
  CV: '238',
};

/**
 * Normalise a phone number to E.164 (`+<callingCode><nationalNumber>`).
 * Idempotent: an already-prefixed number is returned unchanged.
 */
export function normalizePhone(phone: string, country: string): string {
  const callingCode = CALLING_CODES[(country ?? '').toUpperCase()];
  if (!callingCode) {
    throw new KomipayValidationError(`Unsupported country code: "${country}"`);
  }

  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith(callingCode)) {
    digits = digits.slice(callingCode.length);
  }
  if (!digits) {
    throw new KomipayValidationError('Phone number is required');
  }

  return `+${callingCode}${digits}`;
}
