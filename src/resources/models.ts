import type { CardBrand, Channel, TransactionState, TransactionStatus } from '../models/enums';
import type { Fingerprint } from '../utils/fingerprint';

// ─── Gateway (Guichet) ──────────────────────────────────────────────────────
export interface CreateCheckoutParams {
  amount: string | number;
  /** Redirect target after payment — host only, no protocol. */
  returnUrl: string;
}

export interface CheckoutRedirectTarget {
  location: { href: string };
}

/** A generated hosted checkout, with convenience navigation helpers. */
export class CheckoutSession {
  constructor(
    readonly link: string,
    readonly message: string,
    readonly raw?: unknown,
  ) {}

  /** Redirect the payer to the terminal (browser by default). */
  redirect(target?: CheckoutRedirectTarget): void {
    const resolved =
      target ?? ((globalThis as { window?: CheckoutRedirectTarget }).window as CheckoutRedirectTarget);
    if (!resolved?.location) {
      throw new Error(
        'No navigation target available. Pass a window/location or use .link.',
      );
    }
    resolved.location.href = this.link;
  }

  /** Inline embed snippet for the "sans redirection" flow. */
  iframe(options: { width?: string; height?: number; title?: string } = {}): string {
    const width = options.width ?? '100%';
    const height = options.height ?? 715;
    const title = options.title ?? 'KomiPay';
    return `<iframe width="${width}" height="${height}" src="${this.link}" frameborder="0" allowfullscreen title="${title}"></iframe>`;
  }
}

// ─── B2C collections (business profile) ─────────────────────────────────────
export interface CardPaymentParams {
  amount: string | number;
  /** Card number, with or without separators. */
  cardNumber: string;
  /** Expiry as MM/YY (e.g. "12/24"). */
  expiry: string;
  cvv: string;
  payerName: string;
  externalReference: string;
  currency?: string;
  /** Pre-built device fingerprint; auto-detected when omitted. */
  fingerprint?: Fingerprint;
}

export interface CardPaymentResult {
  state: TransactionState;
  reference?: string;
  externalReference: string;
  card?: CardBrand | string;
  amount?: number;
  /** Present when `state === ATTENTE`: send the payer here for 3DS. */
  redirectPortalAuth?: string;
  message: string;
}

export interface MobileMoneyPaymentParams {
  channel: Channel | string;
  amount: string | number;
  phone: string;
  /** ISO country code, e.g. "NE". */
  country: string;
  payerName: string;
  externalReference: string;
}

export interface MobileMoneyPaymentResult {
  reference: string;
  externalReference: string;
  message: string;
}

export interface TransferPaymentParams {
  /** STA channel: nita/amana/zeyna. */
  channel: Channel | string;
  amount: string | number;
  phone: string;
  country: string;
  externalReference: string;
  /** Required for ZeynaCash (obtained via the SMS pre-step). */
  securityCode?: string;
}

export interface TransferPaymentResult {
  reference: string;
  /** MyNita buying code, when returned. */
  codeAchat?: string;
  totalNet?: string;
  message: string;
}

// ─── B2B transfers (aggregator profile) ─────────────────────────────────────
export interface TransferParty {
  phone: string;
  country: string;
}

export interface AggregatorTransferParams {
  channel: Channel | string;
  amount: string | number;
  payer: TransferParty;
  receiver: TransferParty;
  feesBorne: number;
  partnerRate: number;
  komipayPartner: boolean;
  externalReference: string;
  securityCode?: string;
}

export interface AggregatorTransferResult {
  reference: string;
  externalReference: string;
  message: string;
  totalAmount?: string;
  commissions?: {
    total?: string;
    partner?: string;
    mobileMoney?: string;
    komipay?: string;
  };
}

// ─── Status ─────────────────────────────────────────────────────────────────
export interface TransactionStatusResult {
  reference: string;
  transactionStatus: TransactionStatus;
  success: boolean;
  message: string;
}
