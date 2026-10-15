/**
 * Normalise a card number to the 4x4 block format KomiPay expects
 * (e.g. "4012-0010-3714-1112"). Non-digits are ignored.
 */
export function formatCardNumber(card: string): string {
  const digits = (card ?? '').replace(/\D/g, '');
  return digits.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}
