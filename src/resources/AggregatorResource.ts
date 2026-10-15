import type { Session } from '../auth/AuthSession';
import type { KomipayCredentials } from '../config/KomipayConfig';
import { ChannelMeta } from '../models/enums';
import { formatAmount } from '../utils/amount';
import { normalizePhone } from '../utils/phone';
import type {
  AggregatorTransferParams,
  AggregatorTransferResult,
} from './models';

/**
 * B2B Standard (`/b2b_standard`) for the aggregator profile. Moves money
 * between two parties and splits the commission between you and KomiPay.
 */
export class AggregatorResource {
  constructor(
    private readonly session: Session,
    private readonly credentials: KomipayCredentials,
  ) {}

  async send(params: AggregatorTransferParams): Promise<AggregatorTransferResult> {
    const payerPhone = normalizePhone(params.payer.phone, params.payer.country);
    const receiverPhone = normalizePhone(params.receiver.phone, params.receiver.country);

    if (ChannelMeta.requiresSecurityCode(params.channel)) {
      await this.session.authorized({
        method: 'POST',
        path: '/before-integration-b2c-payment-sta',
        body: {
          mobile_money: params.channel,
          numero_telephone: payerPhone,
          api_key: this.credentials.apiKey,
        },
      });
    }

    const body: Record<string, unknown> = {
      mobile_money: params.channel,
      api_key: this.credentials.apiKey,
      montant_a_payer: formatAmount(params.amount),
      numero_telephone_payeur: payerPhone,
      pays_payeur: params.payer.country,
      numero_telephone_receveur: receiverPhone,
      pays_receveur: params.receiver.country,
      imputation_des_frais: String(params.feesBorne),
      taux_partenaire: String(params.partnerRate),
      partenaire_komipay: params.komipayPartner ? 'OUI' : 'NON',
      external_reference: params.externalReference,
    };
    if (params.securityCode) {
      body.security_code = params.securityCode;
    }

    const envelope = await this.session.authorized<{
      reference_transaction: string;
      reference_externe?: string;
      montant_total?: string;
      commission_totale?: string;
      commission_partenaire?: string;
      commission_mobile_money?: string;
      commission_komipay?: string;
    }>({ method: 'POST', path: '/b2b_standard', body });

    return {
      reference: envelope.reference_transaction,
      externalReference: envelope.reference_externe ?? params.externalReference,
      message: envelope.message,
      totalAmount: envelope.montant_total,
      commissions: {
        total: envelope.commission_totale,
        partner: envelope.commission_partenaire,
        mobileMoney: envelope.commission_mobile_money,
        komipay: envelope.commission_komipay,
      },
    };
  }
}
