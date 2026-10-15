import type { Session } from '../auth/AuthSession';
import type { KomipayCredentials } from '../config/KomipayConfig';
import { KomipayApiError } from '../errors/KomipayError';
import { Channel, ChannelMeta, TransactionState } from '../models/enums';
import { formatAmount } from '../utils/amount';
import { formatCardNumber } from '../utils/card';
import { browserFingerprint } from '../utils/fingerprint';
import { normalizePhone } from '../utils/phone';
import type {
  CardPaymentParams,
  CardPaymentResult,
  MobileMoneyPaymentParams,
  MobileMoneyPaymentResult,
  TransferPaymentParams,
  TransferPaymentResult,
} from './models';

interface TransactionData {
  carte?: string;
  reference_transaction?: string;
  reference_externe?: string;
  montant_total?: number;
  montant_transaction?: number;
  commission_totale?: number;
}

/**
 * B2C Standard (`/b2c_standard`) for the business profile: card, operator
 * wallets and STA transfers. Each public method hides the multi-step dance the
 * raw API requires (CVV encryption, Zeyna SMS pre-step, …).
 */
export class CollectionsResource {
  constructor(
    private readonly session: Session,
    private readonly credentials: KomipayCredentials,
  ) {}

  /** Card payment: encrypt CVV, then submit the 3DS-aware card payload. */
  async payWithCard(params: CardPaymentParams): Promise<CardPaymentResult> {
    const { encryptedCvv } = await this.encryptCvv(params.cvv);
    const fingerprint = params.fingerprint ?? browserFingerprint();

    const envelope = await this.session.authorized<{
      etat: TransactionState;
      dataTransaction?: TransactionData;
      redirect_portail_auth?: string;
    }>({
      method: 'POST',
      path: '/b2c_standard',
      headers: this.securedHeaders(),
      body: {
        mobile_money: Channel.BankCard,
        api_key: this.credentials.apiKey,
        nom_prenom_payeur: params.payerName,
        numero_carte_bancaire: formatCardNumber(params.cardNumber),
        date_expiration: params.expiry,
        cvv_number: encryptedCvv,
        montant_a_payer: formatAmount(params.amount),
        reference_externe: params.externalReference,
        javaEnabled: fingerprint.javaEnabled,
        javascriptEnabled: fingerprint.javascriptEnabled,
        screenHeight: fingerprint.screenHeight,
        screenWidth: fingerprint.screenWidth,
        TZ: fingerprint.TZ,
        challengeWindowSize: fingerprint.challengeWindowSize,
      },
    });

    const data: TransactionData = envelope.dataTransaction ?? {};
    return {
      state: envelope.etat,
      reference: data.reference_transaction,
      externalReference: data.reference_externe ?? params.externalReference,
      card: data.carte,
      amount: data.montant_total,
      redirectPortalAuth: envelope.redirect_portail_auth,
      message: envelope.message,
    };
  }

  /** Operator wallet payment (Airtel, Zamani, Moov, …): a single call. */
  async payWithMobileMoney(
    params: MobileMoneyPaymentParams,
  ): Promise<MobileMoneyPaymentResult> {
    const envelope = await this.session.authorized<{
      reference_transaction: string;
    }>({
      method: 'POST',
      path: '/b2c_standard',
      body: {
        mobile_money: params.channel,
        api_key: this.credentials.apiKey,
        montant_a_payer: formatAmount(params.amount),
        numero_telephone_payeur: normalizePhone(params.phone, params.country),
        nom_prenom_payeur: params.payerName,
        reference_externe: params.externalReference,
      },
    });

    return {
      reference: envelope.reference_transaction,
      externalReference: params.externalReference,
      message: envelope.message,
    };
  }

  /** STA transfer (Nita/Amana/Zeyna). Zeyna triggers the SMS pre-step first. */
  async payWithTransfer(
    params: TransferPaymentParams,
  ): Promise<TransferPaymentResult> {
    const phone = normalizePhone(params.phone, params.country);

    if (ChannelMeta.requiresSecurityCode(params.channel)) {
      await this.session.authorized({
        method: 'POST',
        path: '/before-integration-b2c-payment-sta',
        body: {
          mobile_money: params.channel,
          numero_telephone: phone,
          api_key: this.credentials.apiKey,
        },
      });
    }

    const body: Record<string, unknown> = {
      mobile_money: params.channel,
      api_key: this.credentials.apiKey,
      montant_a_payer: formatAmount(params.amount),
      numero_telephone_payeur: phone,
      pays_payeur: params.country,
      reference_externe: params.externalReference,
    };
    if (params.securityCode) {
      body.security_code = params.securityCode;
    }

    const envelope = await this.session.authorized<{
      reference_transaction: string;
      code_achat?: string;
      total_net?: string;
    }>({ method: 'POST', path: '/b2c_standard', body });

    return {
      reference: envelope.reference_transaction,
      codeAchat: envelope.code_achat,
      totalNet: envelope.total_net,
      message: envelope.message,
    };
  }

  private securedHeaders(): Record<string, string> {
    return this.credentials.keypass ? { keypass: this.credentials.keypass } : {};
  }

  private async encryptCvv(cvv: string): Promise<{ encryptedCvv: string }> {
    const envelope = await this.session.authorized<{
      cvv_encrpyt?: string;
      cvv_encrypt?: string;
    }>({
      method: 'POST',
      path: '/crypt-cvv',
      headers: this.securedHeaders(),
      body: { api_key: this.credentials.apiKey, cvv_number: cvv },
    });

    const encryptedCvv = envelope.cvv_encrpyt ?? envelope.cvv_encrypt;
    if (!encryptedCvv) {
      throw new KomipayApiError(
        envelope.code,
        'CVV encryption did not return a value',
        envelope.statut,
        envelope,
      );
    }
    return { encryptedCvv };
  }
}
