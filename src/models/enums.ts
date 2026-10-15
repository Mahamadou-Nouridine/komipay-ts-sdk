/**
 * All known KomiPay literals, captured as enums so callers never pass magic
 * strings. Anything the API documents as "Etc..." stays reachable through the
 * `Channel | string` union used by the resources.
 */

export enum Environment {
  Sandbox = 'sandbox',
  Live = 'live',
}

export enum Profile {
  /** Company / merchant collecting from consumers (B2C). */
  Business = 'entreprise',
  /** Intermediary running transfers between parties (B2B). */
  Aggregator = 'aggregateur',
}

/** The value sent in the `mobile_money` parameter. */
export enum Channel {
  BankCard = 'bank_card',
  AirtelMoney = 'airtel_money',
  ZamaniCash = 'zamani_cash',
  MoovFlooz = 'moov_flooz',
  NitaTransfer = 'nita_transfert',
  AmanaTransfer = 'amana_transfert',
  ZeynaTransfer = 'zeyna_transfert',
}

/** The `etat` returned by the B2C card endpoint. */
export enum TransactionState {
  Pending = 'ATTENTE',
  Success = 'SUCCESS',
}

/** The `transactionStatus` returned by the status endpoint. */
export enum TransactionStatus {
  Success = 'Success',
  Failed = 'Echec',
}

export enum CardBrand {
  Visa = 'VISA',
  Mastercard = 'MASTERCARD',
}

export enum ChallengeWindowSize {
  W250x400 = '01',
  W390x400 = '02',
  W500x600 = '03',
  W600x400 = '04',
  Fullscreen = '05',
}

export enum KomipayCode {
  Success = 200,
  BadRequest = 400,
  Unauthorized = 401,
}

export enum Currency {
  XOF = 'XOF',
}

/** Who bears the transaction fees on a B2B transfer (1 = payer, 0 = receiver). */
export enum FeeBearer {
  Receiver = 0,
  Payer = 1,
}

const CARD_CHANNELS = new Set<string>([Channel.BankCard]);
const WALLET_CHANNELS = new Set<string>([
  Channel.AirtelMoney,
  Channel.ZamaniCash,
  Channel.MoovFlooz,
]);
const TRANSFER_CHANNELS = new Set<string>([
  Channel.NitaTransfer,
  Channel.AmanaTransfer,
  Channel.ZeynaTransfer,
]);

/** Classification helpers so resources branch on capability, not raw strings. */
export const ChannelMeta = {
  isCard: (channel: Channel | string): boolean => CARD_CHANNELS.has(channel),
  isWallet: (channel: Channel | string): boolean => WALLET_CHANNELS.has(channel),
  isTransfer: (channel: Channel | string): boolean => TRANSFER_CHANNELS.has(channel),
  requiresSecurityCode: (channel: Channel | string): boolean =>
    channel === Channel.ZeynaTransfer,
} as const;
