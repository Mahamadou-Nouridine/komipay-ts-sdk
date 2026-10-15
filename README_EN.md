# @nourlabs/komipay-sdk

[README en français](README.md) · **English**

> ⚠️ **This project is not an official KomiPay SDK.** It is an independent,
> unofficial implementation built from the
> [public KomiPay API documentation](https://komipay.com/index.php/docs-api),
> with no affiliation to or endorsement by KomiPay.

A standalone, framework-agnostic OOP TypeScript SDK for the KomiPay API. It handles authentication, B2C/B2B payments and transaction status with a strict, profile-aware type surface.

- Fully typed API (TypeScript strict)
- Token session management (automatic auth + one 401 retry)
- Profile separation: `entreprise` (Business) vs `aggregateur` (Aggregator) — enforced at compile time *and* at runtime
- Structured, descriptive errors
- Vitest test suite, CJS build for Node.js
- Zero runtime dependencies (global `fetch`)

## About KomiPay

[KomiPay](https://komipay.com) is an online payment platform based in Niger
that provides a **single API** covering several payment methods: mobile money
(Airtel Money, Moov/Flooz, Zamani Cash), bank cards (Visa/Mastercard with
3DS) and STA transfers (MyNita, Amana, Zeyna). Depending on your account you
operate either as a **Business** profile (B2C payments) or an **Aggregator**
profile (B2B transfers).

- Website: [https://komipay.com](https://komipay.com)
- Official API docs: [https://komipay.com/index.php/docs-api](https://komipay.com/index.php/docs-api)

## Installation

```bash
npm install @nourlabs/komipay-sdk
```

## Quick start

```ts
import {
  Komipay,
  Environment,
  Profile,
  Channel,
  TransactionState,
} from '@nourlabs/komipay-sdk';

const komipay = new Komipay({
  credentials: {
    apiKey: process.env.KOMIPAY_API_KEY!,
    login: process.env.KOMIPAY_LOGIN!,
    password: process.env.KOMIPAY_PASSWORD!,
    keypass: process.env.KOMIPAY_KEYPASS!, // required for card payments
  },
  environment: Environment.Sandbox, // or Environment.Live
  profile: Profile.Business, // or Profile.Aggregator
});
```

## Usage

### Hosted checkout (Guichet-KomiPay)

```ts
const checkout = await komipay.gateway.create({
  amount: 5000,
  returnUrl: 'votre-site.com/retour', // host only — no protocol, KomiPay prepends it
});

console.log(checkout.link); // redirect the payer here
console.log(checkout.iframe()); // or embed the terminal inline
```

### B2C payments (Business profile / "entreprise")

```ts
// Mobile money (Airtel, Zamani, Moov)
await komipay.collections.payWithMobileMoney({
  channel: Channel.AirtelMoney,
  amount: 5000,
  phone: '+22796001122',
  country: 'NE',
  payerName: 'Ali Mahamane',
  externalReference: 'DEMO-123',
});

// Credit card (3DS when required)
const card = await komipay.collections.payWithCard({
  amount: 5000,
  cardNumber: '4012-0010-3714-1112',
  expiry: '12/24',
  cvv: '123',
  payerName: 'Ali Mahamane',
  externalReference: 'DEMO-124',
});

if (card.state === TransactionState.Pending && card.redirectPortalAuth) {
  // Send the payer to the 3DS challenge
  console.log(card.redirectPortalAuth);
}

// STA transfer (MyNita / Amana / Zeyna)
await komipay.collections.payWithTransfer({
  channel: Channel.NitaTransfer,
  amount: 5000,
  phone: '+22796001122',
  country: 'NE',
  externalReference: 'DEMO-125',
  // securityCode: '12345', // required for Zeyna (obtained via the SMS pre-step)
});
```

### B2B transfers (Aggregator profile / "aggregateur")

Requires a client constructed with `{ profile: Profile.Aggregator }` — on a
Business client `transfers` is `never` and throws `KomipayProfileError`.

```ts
const b2b = await komipay.transfers.send({
  channel: Channel.AmanaTransfer,
  amount: 5000,
  payer: { phone: '+22796001122', country: 'NE' },
  receiver: { phone: '+22797002233', country: 'NE' },
  feesBorne: 1, // 1 = payer bears fees, 0 = receiver
  partnerRate: 1.5,
  komipayPartner: true, // required for aggregators → partenaire_komipay: "OUI"
  externalReference: 'B2B-001',
});

console.log(b2b.commissions);
```

> **Important:** on an Aggregator profile, `komipayPartner: true`
> (`partenaire_komipay: "OUI"`) is **mandatory**. Without it KomiPay responds
> `400 — Veuillez fournir votre code partenaire en paramètre`.

### Transaction status

```ts
const status = await komipay.transactions.status('RT123456789');
console.log(status.transactionStatus, status.success);
```

> **Note:** KomiPay holds this endpoint open until the payer validates (up to
> 5 minutes). The status call therefore uses its own 5-minute timeout; every
> other call defaults to 30 s (configurable via `timeout`).

### Profile gating

Each profile only gets the resources it can actually use — statically and at
runtime:

```ts
const business = new Komipay({ credentials, profile: Profile.Business });

business.collections; // CollectionsResource
business.transfers;   // typed `never` → throws KomipayProfileError at runtime
```

Constructing the client with the literal `Profile.Aggregator` inverts the
availability: `transfers` works, `collections` becomes `never`.

### Error handling

```ts
import { KomipayError } from '@nourlabs/komipay-sdk';

try {
  await komipay.collections.payWithMobileMoney({ /* ... */ });
} catch (error) {
  if (error instanceof KomipayError) {
    console.error(error.kind);    // authentication | validation | api | network | timeout | profile
    console.error(error.code);    // provider code, 0 when unknown
    console.error(error.message);
    console.error(error.raw);     // last raw payload, for reconciliation/debugging
  }
}
```

Available subclasses: `KomipayAuthenticationError`, `KomipayValidationError`,
`KomipayApiError`, `KomipayNetworkError`, `KomipayTimeoutError`,
`KomipayProfileError`.

### Configuration options

| Option | Default | Purpose |
| --- | --- | --- |
| `timeout` | `30_000` | Per-request timeout in ms |
| `tokenStore` | in-memory | Inject your own token cache |
| `fetch` | global | Injectable transport (tests/proxies) |
| `now` | `Date.now` | Injectable clock for deterministic token expiry |
| `safetyWindowMs` | 5 min | Refresh the token this early before expiry |

## Security & best practices

- **Never** store cardholder data. The SDK encrypts the CVV via `/crypt-cvv`, in line with PCI-DSS.
- Always pass a unique `externalReference` for idempotency on your side.
- On Live, verify status (or webhook) before treating a payment as final.
- Keep credentials (`apiKey`, `login`, `password`, `keypass`) in environment variables.

## Development

```bash
npm install
npm test
npm run test:watch
npm run typecheck
npm run build
```

## Contributing

Contributions are welcome. Recommended workflow:

### 1. Fork & Clone
1. Fork the repository on GitHub
2. Clone your fork: `git clone https://github.com/VOTRE-USERNAME/komipay-sdk.git && cd komipay-sdk`
3. Add the upstream: `git remote add upstream https://github.com/mahamadou-nouridine/komipay-sdk.git`

### 2. Prepare the environment
```bash
npm install
npm run typecheck
npm test
```

### 3. Create a branch
```bash
git checkout -b feat/descriptive-name
# or fix/descriptive-bugfix
```

### 4. Develop & Test
- Follow the existing style (TypeScript strict)
- Add/extend Vitest tests for any behaviour change
- Ensure `npm run typecheck`, `npm test` and `npm run build` all pass

### 5. Open a Pull Request
1. Push: `git push origin feat/descriptive-name`
2. Open a PR on GitHub against `mahamadou-nouridine/komipay-sdk:main`
3. Describe the changes and the tests clearly

### 6. Report a bug / propose an idea
Use the [GitHub Issues](https://github.com/mahamadou-nouridine/komipay-sdk/issues).

## Author

**Mahamadou Nouridine** — [nouridine.com](https://nouridine.com) ·
[github.com/mahamadou-nouridine](https://github.com/mahamadou-nouridine)

## License

[MIT](LICENSE)
