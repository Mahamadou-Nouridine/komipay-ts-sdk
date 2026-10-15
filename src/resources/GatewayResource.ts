import type { Session } from '../auth/AuthSession';
import type { KomipayCredentials } from '../config/KomipayConfig';
import { formatAmount } from '../utils/amount';
import { CheckoutSession, type CreateCheckoutParams } from './models';

/**
 * Guichet-KomiPay: a preconfigured hosted terminal. Generate a checkout and
 * either redirect the payer to it or embed it inline.
 */
export class GatewayResource {
  constructor(
    private readonly session: Session,
    private readonly credentials: KomipayCredentials,
  ) {}

  async create(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const envelope = await this.session.authorized<{
      lien_guichet: string;
    }>({
      method: 'POST',
      path: '/generate-payment-gateway',
      body: {
        api_key: this.credentials.apiKey,
        montant_a_payer: formatAmount(params.amount),
        url_retour: params.returnUrl,
      },
    });

    return new CheckoutSession(envelope.lien_guichet, envelope.message, envelope);
  }
}
