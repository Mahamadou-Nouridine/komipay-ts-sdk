import { KomipayValidationError } from '../errors/KomipayError';

/**
 * Normalise an amount to the plain integer string the API expects.
 * Accepts numbers and strings, tolerates thousands separators ("10 000").
 */
export function formatAmount(value: string | number): string {
  const raw = typeof value === 'number' ? String(value) : value;
  const cleaned = (raw ?? '').replace(/[\s\u00A0]/g, '');

  if (!/^\d+$/.test(cleaned)) {
    throw new KomipayValidationError(`Invalid amount: "${String(value)}"`);
  }

  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new KomipayValidationError('Amount must be a positive integer');
  }

  return String(amount);
}
