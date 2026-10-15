import {
  Komipay,
  Environment,
  Profile,
  Channel,
  TransactionState,
  KomipayError,
} from '../src';

const credentials = { apiKey: 'k', login: 'l', password: 'p', keypass: 'kp' };

const komipay = new Komipay({
  credentials,
  environment: Environment.Sandbox,
  profile: Profile.Business,
});

const aggregator = new Komipay({
  credentials,
  environment: Environment.Sandbox,
  profile: Profile.Aggregator,
});

async function snippets(): Promise<void> {
  const checkout = await komipay.gateway.create({
    amount: 5000,
    returnUrl: 'votre-site.com/retour',
  });
  console.log(checkout.link, checkout.iframe());

  await komipay.collections.payWithMobileMoney({
    channel: Channel.AirtelMoney,
    amount: 5000,
    phone: '+22796001122',
    country: 'NE',
    payerName: 'Ali Mahamane',
    externalReference: 'DEMO-123',
  });

  const card = await komipay.collections.payWithCard({
    amount: 5000,
    cardNumber: '4012-0010-3714-1112',
    expiry: '12/24',
    cvv: '123',
    payerName: 'Ali Mahamane',
    externalReference: 'DEMO-124',
  });

  if (card.state === TransactionState.Pending && card.redirectPortalAuth) {
    console.log(card.redirectPortalAuth);
  }

  await komipay.collections.payWithTransfer({
    channel: Channel.NitaTransfer,
    amount: 5000,
    phone: '+22796001122',
    country: 'NE',
    externalReference: 'DEMO-125',
    securityCode: '12345',
  });

  const b2b = await aggregator.transfers.send({
    channel: Channel.AmanaTransfer,
    amount: 5000,
    payer: { phone: '+22796001122', country: 'NE' },
    receiver: { phone: '+22797002233', country: 'NE' },
    feesBorne: 1,
    partnerRate: 1.5,
    komipayPartner: true,
    externalReference: 'B2B-001',
  });
  console.log(b2b.commissions);

  const status = await komipay.transactions.status('RT123456789');
  console.log(status.transactionStatus, status.success);
}

async function errors(): Promise<void> {
  try {
    await komipay.collections.payWithMobileMoney({
      channel: Channel.AirtelMoney,
      amount: 5000,
      phone: '+22796001122',
      country: 'NE',
      payerName: 'x',
      externalReference: 'y',
    });
  } catch (error) {
    if (error instanceof KomipayError) {
      console.error(error.kind, error.code, error.message, error.raw);
    }
  }
}

void snippets;
void errors;

// Profile gating: `transfers` must be `never` on a Business client.
const business = new Komipay({
  credentials,
  profile: Profile.Business,
});
const collectionsOnly: typeof business.collections = business.collections;
void collectionsOnly;
// Compiles only because `transfers` is `never` on the Business profile —
// if the gating regressed, assigning the resource to `never` would fail.
const transfersOnBusiness: never = business.transfers;
void transfersOnBusiness;
