import { describe, it, expect } from 'vitest';
import {
  GatewayResource,
  CollectionsResource,
  AggregatorResource,
  TransactionsResource,
  Channel,
  TransactionState,
  TransactionStatus,
  FeeBearer,
  KomipayCredentials,
  ChallengeWindowSize,
  Fingerprint,
} from '../src';
import { makeSession, okEnvelope } from './fixtures';

const credentials: KomipayCredentials = {
  apiKey: 'api_123',
  keypass: 'kp_1',
  login: 'merchant@x.com',
  password: 'secret',
};

const fingerprint: Fingerprint = {
  javaEnabled: false,
  javascriptEnabled: true,
  screenHeight: '960',
  screenWidth: '1536',
  TZ: '1',
  challengeWindowSize: ChallengeWindowSize.Fullscreen,
};

describe('GatewayResource (Guichet)', () => {
  it('creates a checkout session with a normalized amount', async () => {
    const { session, calls } = makeSession(() =>
      okEnvelope({ lien_guichet: 'https://komipay.com/pay/abc' }),
    );
    const gateway = new GatewayResource(session, credentials);

    const checkout = await gateway.create({ amount: '10 000', returnUrl: 'www.siteweb.com' });

    expect(calls[0].path).toBe('/generate-payment-gateway');
    expect(calls[0].body).toEqual({
      api_key: 'api_123',
      montant_a_payer: '10000',
      url_retour: 'www.siteweb.com',
    });
    expect(checkout.link).toBe('https://komipay.com/pay/abc');
  });

  it('exposes an iframe embed helper', async () => {
    const { session } = makeSession(() => okEnvelope({ lien_guichet: 'https://komipay.com/pay/abc' }));
    const checkout = await new GatewayResource(session, credentials).create({
      amount: 5000,
      returnUrl: 'www.x.com',
    });
    expect(checkout.iframe()).toContain('src="https://komipay.com/pay/abc"');
    expect(checkout.iframe({ height: 500 })).toContain('height="500"');
  });

  it('redirect helper writes to the provided location', async () => {
    const { session } = makeSession(() => okEnvelope({ lien_guichet: 'https://komipay.com/pay/abc' }));
    const checkout = await new GatewayResource(session, credentials).create({ amount: 1, returnUrl: 'x' });
    const target = { location: { href: '' } };
    checkout.redirect(target);
    expect(target.location.href).toBe('https://komipay.com/pay/abc');
  });
});

describe('CollectionsResource (B2C)', () => {
  it('card payment encrypts the CVV first, then calls b2c_standard', async () => {
    const { session, calls } = makeSession((spec) => {
      if (spec.path === '/crypt-cvv') return okEnvelope({ cvv_encrpyt: 'ENC_CVV' });
      return okEnvelope({
        protocol3ds: 2,
        etat: TransactionState.Success,
        dataTransaction: {
          carte: 'MASTERCARD',
          reference_transaction: 'RT_1',
          reference_externe: 'INV-1',
          montant_total: 10000,
          montant_transaction: 9500,
          commission_totale: 500,
        },
      });
    });
    const collections = new CollectionsResource(session, credentials);

    const result = await collections.payWithCard({
      amount: '25 000',
      cardNumber: '4012-0010-3714-1112',
      expiry: '12/24',
      cvv: '123',
      payerName: 'Jane Doe',
      externalReference: 'INV-1',
      fingerprint,
    });

    // CVV encryption step
    expect(calls[0].path).toBe('/crypt-cvv');
    expect(calls[0].body).toEqual({ api_key: 'api_123', cvv_number: '123' });
    expect(calls[0].headers?.keypass).toBe('kp_1');

    // B2C step
    expect(calls[1].path).toBe('/b2c_standard');
    expect(calls[1].headers?.keypass).toBe('kp_1');
    expect(calls[1].body).toMatchObject({
      mobile_money: 'bank_card',
      api_key: 'api_123',
      nom_prenom_payeur: 'Jane Doe',
      numero_carte_bancaire: '4012-0010-3714-1112',
      date_expiration: '12/24',
      cvv_number: 'ENC_CVV',
      montant_a_payer: '25000',
      reference_externe: 'INV-1',
      javaEnabled: false,
      screenWidth: '1536',
      challengeWindowSize: '05',
    });

    expect(result.state).toBe(TransactionState.Success);
    expect(result.reference).toBe('RT_1');
    expect(result.card).toBe('MASTERCARD');
  });

  it('returns the 3DS redirect link when the state is ATTENTE', async () => {
    const { session } = makeSession((spec) => {
      if (spec.path === '/crypt-cvv') return okEnvelope({ cvv_encrpyt: 'ENC' });
      return okEnvelope({
        etat: TransactionState.Pending,
        dataTransaction: { carte: 'VISA', reference_transaction: 'RT_2' },
        redirect_portail_auth: 'https://komipay.com/3ds/xyz',
      });
    });
    const result = await new CollectionsResource(session, credentials).payWithCard({
      amount: 1,
      cardNumber: '4012001037141112',
      expiry: '12/24',
      cvv: '123',
      payerName: 'Jane',
      externalReference: 'INV-2',
      fingerprint,
    });

    expect(result.state).toBe(TransactionState.Pending);
    expect(result.redirectPortalAuth).toBe('https://komipay.com/3ds/xyz');
  });

  it('accepts the alternate cvv_encrypt key', async () => {
    const { session, calls } = makeSession((spec) => {
      if (spec.path === '/crypt-cvv') return okEnvelope({ cvv_encrypt: 'ENC2' });
      return okEnvelope({ etat: TransactionState.Success, dataTransaction: { reference_transaction: 'RT' } });
    });
    await new CollectionsResource(session, credentials).payWithCard({
      amount: 1,
      cardNumber: '4012001037141112',
      expiry: '12/24',
      cvv: '123',
      payerName: 'Jane',
      externalReference: 'INV',
      fingerprint,
    });
    expect((calls[1].body as any).cvv_number).toBe('ENC2');
  });

  it('pays with an operator wallet in a single call', async () => {
    const { session, calls } = makeSession(() => okEnvelope({ reference_transaction: 'RT_W1' }));
    const result = await new CollectionsResource(session, credentials).payWithMobileMoney({
      channel: Channel.AirtelMoney,
      amount: '5 000',
      phone: '96 00 11 22',
      country: 'NE',
      payerName: 'Jane Doe',
      externalReference: 'INV-3',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/b2c_standard');
    expect(calls[0].body).toEqual({
      mobile_money: 'airtel_money',
      api_key: 'api_123',
      montant_a_payer: '5000',
      numero_telephone_payeur: '+22796001122',
      nom_prenom_payeur: 'Jane Doe',
      reference_externe: 'INV-3',
    });
    expect(result.reference).toBe('RT_W1');
  });

  it('pays via Nita/Amana transfer and returns the buying code', async () => {
    const { session, calls } = makeSession(() =>
      okEnvelope({ reference_transaction: 'RT_T1', code_achat: 'C-99', total_net: '5000' }),
    );
    const result = await new CollectionsResource(session, credentials).payWithTransfer({
      channel: Channel.NitaTransfer,
      amount: '5 000',
      phone: '+22796001122',
      country: 'NE',
      externalReference: 'INV-4',
    });

    expect(calls[0].body).toMatchObject({
      mobile_money: 'nita_transfert',
      pays_payeur: 'NE',
      numero_telephone_payeur: '+22796001122',
    });
    expect(result.codeAchat).toBe('C-99');
    expect(result.reference).toBe('RT_T1');
  });

  it('runs the SMS pre-step for Zeyna before the transfer', async () => {
    const { session, calls } = makeSession((spec) => {
      if (spec.path === '/before-integration-b2c-payment-sta') return okEnvelope({ tentative: 2 });
      return okEnvelope({ reference_transaction: 'RT_Z1' });
    });
    await new CollectionsResource(session, credentials).payWithTransfer({
      channel: Channel.ZeynaTransfer,
      amount: '5 000',
      phone: '+22796001122',
      country: 'NE',
      externalReference: 'INV-5',
      securityCode: '12345',
    });

    expect(calls[0].path).toBe('/before-integration-b2c-payment-sta');
    expect(calls[0].body).toEqual({
      mobile_money: 'zeyna_transfert',
      numero_telephone: '+22796001122',
      api_key: 'api_123',
    });
    expect(calls[1].path).toBe('/b2c_standard');
    expect((calls[1].body as any).security_code).toBe('12345');
  });
});

describe('AggregatorResource (B2B)', () => {
  it('sends a transfer with receiver, fee bearer and partner commission', async () => {
    const { session, calls } = makeSession(() =>
      okEnvelope({
        reference_transaction: 'RT_B2B',
        reference_externe: 'PAY-88',
        montant_total: '5000',
        commission_totale: '100',
        commission_partenaire: '50',
        commission_mobile_money: '30',
        commission_komipay: '20',
      }),
    );
    const aggregator = new AggregatorResource(session, credentials);

    const result = await aggregator.send({
      channel: Channel.NitaTransfer,
      amount: '5 000',
      payer: { phone: '+22796001122', country: 'NE' },
      receiver: { phone: '+22797002233', country: 'NE' },
      feesBorne: FeeBearer.Payer,
      partnerRate: 1.5,
      komipayPartner: true,
      externalReference: 'PAY-88',
    });

    expect(calls[0].path).toBe('/b2b_standard');
    expect(calls[0].body).toMatchObject({
      mobile_money: 'nita_transfert',
      montant_a_payer: '5000',
      numero_telephone_payeur: '+22796001122',
      pays_payeur: 'NE',
      numero_telephone_receveur: '+22797002233',
      pays_receveur: 'NE',
      imputation_des_frais: '1',
      taux_partenaire: '1.5',
      partenaire_komipay: 'OUI',
      external_reference: 'PAY-88',
    });
    expect(result.reference).toBe('RT_B2B');
    expect(result.commissions?.partner).toBe('50');
  });

  it('marks fee bearer receiver as "0" and partner as "NON"', async () => {
    const { session, calls } = makeSession(() => okEnvelope({ reference_transaction: 'RT' }));
    await new AggregatorResource(session, credentials).send({
      channel: Channel.AmanaTransfer,
      amount: 1000,
      payer: { phone: '+22796001122', country: 'NE' },
      receiver: { phone: '+22797002233', country: 'NE' },
      feesBorne: FeeBearer.Receiver,
      partnerRate: 0,
      komipayPartner: false,
      externalReference: 'PAY-1',
    });
    expect((calls[0].body as any).imputation_des_frais).toBe('0');
    expect((calls[0].body as any).partenaire_komipay).toBe('NON');
  });
});

describe('TransactionsResource', () => {
  it('checks status with allowFailure and reports success', async () => {
    const { session, calls } = makeSession(() =>
      okEnvelope({ message: 'La transaction a été effectuée avec succès', data: { transactionStatus: 'Success' } }),
    );
    const result = await new TransactionsResource(session, credentials).status('RT_1');

    expect(calls[0].path).toBe('/check-transaction-status');
    expect(calls[0].allowFailure).toBe(true);
    expect(calls[0].timeout).toBe(5 * 60 * 1000);
    expect(calls[0].body).toEqual({ apikey: 'api_123', reference_transaction: 'RT_1' });
    expect(result.transactionStatus).toBe(TransactionStatus.Success);
    expect(result.success).toBe(true);
  });

  it('reports a failed transaction without throwing', async () => {
    const { session } = makeSession(() => ({
      code: 400,
      statut: false,
      message: 'Echec lors de la transaction, veuillez réessayer !',
      data: { transactionStatus: 'Echec' },
    }));
    const result = await new TransactionsResource(session, credentials).status('RT_2');

    expect(result.success).toBe(false);
    expect(result.transactionStatus).toBe(TransactionStatus.Failed);
  });
});
