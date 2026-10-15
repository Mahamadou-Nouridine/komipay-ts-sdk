// Public surface of the KomiPay SDK — everything a consumer needs.

export { Komipay } from './Komipay';
export type { CollectionsFor, TransfersFor } from './Komipay';

// Enums & capability helpers
export * from './models/enums';

// Errors
export * from './errors/KomipayError';

// Config
export * from './config/KomipayConfig';

// Transport
export * from './http/types';
export { HttpClient } from './http/HttpClient';
export { resolveEndpoints } from './http/resolveEndpoints';

// Auth / token storage
export * from './auth/TokenStore';
export { MemoryTokenStore } from './auth/MemoryTokenStore';
export { AuthSession, parseExpiry } from './auth/AuthSession';
export type { Session, AuthSessionOptions } from './auth/AuthSession';

// Utilities
export { formatAmount } from './utils/amount';
export { normalizePhone } from './utils/phone';
export { formatCardNumber } from './utils/card';
export {
  browserFingerprint,
  challengeWindowSizeFor,
} from './utils/fingerprint';
export type { Fingerprint, FingerprintSource } from './utils/fingerprint';

// Resource models & results
export * from './resources/models';

// Resources
export { GatewayResource } from './resources/GatewayResource';
export { CollectionsResource } from './resources/CollectionsResource';
export { AggregatorResource } from './resources/AggregatorResource';
export { TransactionsResource } from './resources/TransactionsResource';
