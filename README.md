# @nourlabs/komipay-sdk

**Français** · [English README](README_EN.md)

> ⚠️ **Ce projet n'est pas un SDK officiel de KomiPay.** C'est une
> implémentation indépendante et non officielle, réalisée à partir de la
> [documentation publique de l'API KomiPay](https://komipay.com/index.php/docs-api),
> sans affiliation avec KomiPay ni garantie de l'éditeur.

Un SDK TypeScript OOP autonome, agnostique au framework, pour l'API KomiPay. Il gère l'authentification, les paiements B2C/B2B et la vérification de statut avec une surface de types stricte et consciente du profil.

- API entièrement typée (TypeScript strict)
- Gestion de session avec token (authentification automatique + une nouvelle tentative sur 401)
- Séparation par profil : `entreprise` (Business) vs `aggregateur` (Aggregator) — appliquée à la compilation *et* à l'exécution
- Erreurs structurées et descriptives
- Suite de tests Vitest, build CJS pour Node.js
- Zéro dépendance runtime (fetch global)

## À propos de KomiPay

[KomiPay](https://komipay.com) est une plateforme de paiement en ligne basée au Niger qui fournit une **API unique** permettant d'intégrer plusieurs moyens de paiement : mobile money (Airtel Money, Moov/Flooz, Zamani Cash), cartes bancaires (Visa/Mastercard avec 3DS) et transferts STA (MyNita, Amana, Zeyna). Selon votre compte, vous opérez soit en profil **Entreprise** (paiements B2C), soit en profil **Agrégateur** (transferts B2B).

- Site : [https://komipay.com](https://komipay.com)
- Documentation API officielle : [https://komipay.com/index.php/docs-api](https://komipay.com/index.php/docs-api)

## Installation

```bash
npm install @nourlabs/komipay-sdk
```

## Démarrage rapide

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
    keypass: process.env.KOMIPAY_KEYPASS!, // requis pour les paiements par carte
  },
  environment: Environment.Sandbox, // ou Environment.Live
  profile: Profile.Business, // ou Profile.Aggregator
});
```

## Utilisation

### Guichet de paiement hébergé (Guichet-KomiPay)

```ts
const checkout = await komipay.gateway.create({
  amount: 5000,
  returnUrl: 'votre-site.com/retour', // hôte seul — sans protocole, KomiPay l'ajoute
});

console.log(checkout.link); // redirigez le payeur ici
console.log(checkout.iframe()); // ou intégrez le terminal en iframe
```

### Paiements B2C (profil Business / "entreprise")

```ts
// Mobile Money (Airtel, Zamani, Moov)
await komipay.collections.payWithMobileMoney({
  channel: Channel.AirtelMoney,
  amount: 5000,
  phone: '+22796001122',
  country: 'NE',
  payerName: 'Ali Mahamane',
  externalReference: 'DEMO-123',
});

// Carte bancaire (3DS si requis)
const card = await komipay.collections.payWithCard({
  amount: 5000,
  cardNumber: '4012-0010-3714-1112',
  expiry: '12/24',
  cvv: '123',
  payerName: 'Ali Mahamane',
  externalReference: 'DEMO-124',
});

if (card.state === TransactionState.Pending && card.redirectPortalAuth) {
  // Redirigez le payeur vers le défi 3DS
  console.log(card.redirectPortalAuth);
}

// Transfert STA (MyNita / Amana / Zeyna)
await komipay.collections.payWithTransfer({
  channel: Channel.NitaTransfer,
  amount: 5000,
  phone: '+22796001122',
  country: 'NE',
  externalReference: 'DEMO-125',
  // securityCode: '12345', // requis pour Zeyna (obtenu via l'étape SMS préalable)
});
```

### Transferts B2B (profil Aggregator / "aggregateur")

Nécessite un client construit avec `{ profile: Profile.Aggregator }` — sur un
client Business, `transfers` vaut `never` et lève `KomipayProfileError`.

```ts
const b2b = await komipay.transfers.send({
  channel: Channel.AmanaTransfer,
  amount: 5000,
  payer: { phone: '+22796001122', country: 'NE' },
  receiver: { phone: '+22797002233', country: 'NE' },
  feesBorne: 1, // 1 = les frais sont à la charge du payeur, 0 = du receveur
  partnerRate: 1.5,
  komipayPartner: true, // requis pour un agrégateur → partenaire_komipay: "OUI"
  externalReference: 'B2B-001',
});

console.log(b2b.commissions);
```

> **Important :** pour un profil Agrégateur, `komipayPartner: true`
> (`partenaire_komipay: "OUI"`) est **obligatoire**. Sans lui, KomiPay répond
> `400 — Veuillez fournir votre code partenaire en paramètre`.

### Statut d'une transaction

```ts
const status = await komipay.transactions.status('RT123456789');
console.log(status.transactionStatus, status.success);
```

> **Note :** KomiPay maintient cet appel ouvert jusqu'à ce que le payeur
> valide (jusqu'à 5 minutes). L'appel de statut utilise donc son propre délai
> d'attente de 5 minutes ; tous les autres appels utilisent 30 s par défaut
> (configurable via `timeout`).

### Gating par profil

Chaque profil ne reçoit que les ressources réellement utilisables — à la
compilation comme à l'exécution :

```ts
const business = new Komipay({ credentials, profile: Profile.Business });

business.collections; // CollectionsResource
business.transfers;   // typé `never` → lève KomipayProfileError à l'exécution
```

Construire le client avec le littéral `Profile.Aggregator` inverse la
disponibilité : `transfers` fonctionne, `collections` devient `never`.

### Gestion des erreurs

```ts
import { KomipayError } from '@nourlabs/komipay-sdk';

try {
  await komipay.collections.payWithMobileMoney({ /* ... */ });
} catch (error) {
  if (error instanceof KomipayError) {
    console.error(error.kind);    // authentication | validation | api | network | timeout | profile
    console.error(error.code);    // code fournisseur, 0 si inconnu
    console.error(error.message);
    console.error(error.raw);     // dernière charge utile brute, pour réconciliation/debug
  }
}
```

Sous-classes disponibles : `KomipayAuthenticationError`, `KomipayValidationError`,
`KomipayApiError`, `KomipayNetworkError`, `KomipayTimeoutError`,
`KomipayProfileError`.

### Options de configuration

| Option | Défaut | Rôle |
| --- | --- | --- |
| `timeout` | `30_000` | Délai d'attente par requête (ms) |
| `tokenStore` | en mémoire | Injectez votre propre cache de tokens |
| `fetch` | global | Transport injectable (tests/proxies) |
| `now` | `Date.now` | Horloge injectable pour une expiration déterministe |
| `safetyWindowMs` | 5 min | Rafraîchit le token ce tôt avant expiration |

## Sécurité et bonnes pratiques

- **Ne jamais** conserver les données de carte bancaire. Le SDK chiffre le CVV via `/crypt-cvv`, conformément aux recommandations PCI-DSS.
- Toujours fournir un `externalReference` unique pour assurer l'idempotence côté métier.
- Sur l'environnement Live, vérifier le statut (ou le webhook) avant de considérer un paiement comme finalisé.
- Garder les identifiants (`apiKey`, `login`, `password`, `keypass`) dans des variables d'environnement.

## Développement

```bash
npm install
npm test
npm run test:watch
npm run typecheck
npm run build
```

## Contribution

Les contributions sont les bienvenues. Processus recommandé :

### 1. Fork & Clone
1. Forkez le dépôt sur GitHub
2. Clonez votre fork : `git clone https://github.com/VOTRE-USERNAME/komipay-sdk.git && cd komipay-sdk`
3. Ajoutez l'upstream : `git remote add upstream https://github.com/mahamadou-nouridine/komipay-sdk.git`

### 2. Préparer l'environnement
```bash
npm install
npm run typecheck
npm test
```

### 3. Créer une branche
```bash
git checkout -b feat/nom-descriptif
# ou fix/nom-du-bug
```

### 4. Développer & Tester
- Respectez le style existant (TypeScript strict)
- Ajoutez/complétez les tests Vitest pour tout changement de comportement
- Vérifiez que `npm run typecheck`, `npm test` et `npm run build` passent

### 5. Ouvrir une Pull Request
1. Poussez : `git push origin feat/nom-descriptif`
2. Ouvrez une PR sur GitHub vers `mahamadou-nouridine/komipay-sdk:dev`
3. Décrivez clairement les changements et les tests

### 6. Signaler un bug / Proposer une idée
Utilisez les [Issues GitHub](https://github.com/mahamadou-nouridine/komipay-sdk/issues).

## Auteur

**Mahamadou Nouridine** — [nouridine.com](https://nouridine.com) ·
[github.com/mahamadou-nouridine](https://github.com/mahamadou-nouridine)

## Licence

[MIT](LICENSE)
