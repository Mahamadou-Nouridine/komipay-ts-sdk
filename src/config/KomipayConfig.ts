import { Environment, Profile } from '../models/enums';
import type { FetchLike } from '../http/types';
import type { TokenStore } from '../auth/TokenStore';

/** Credentials the caller obtained from the KomiPay dashboard. */
export interface KomipayCredentials {
  /** Active API key. Identifies the account on every request. */
  apiKey: string;
  /** Pass-key required by the card/CVV endpoints. */
  keypass?: string;
  /** Account login — required to mint a token. */
  login?: string;
  /** Account password — required to mint a token. */
  password?: string;
}

export interface KomipayConfig<P extends Profile = Profile> {
  credentials: KomipayCredentials;
  /** Defaults to `Environment.Sandbox`. */
  environment?: Environment;
  /**
   * Defaults to `Profile.Business`. Gates which operations are available — pass
   * the literal (`Profile.Business` / `Profile.Aggregator`) to get compile-time
   * narrowing on the client.
   */
  profile?: P;
  /** Per-request timeout in ms. Defaults to 30 000. */
  timeout?: number;
  /** Injectable fetch (defaults to the global). */
  fetch?: FetchLike;
  /** Token cache. Defaults to an in-memory store. */
  tokenStore?: TokenStore;
  /** Injectable clock (epoch ms) for deterministic token expiry. */
  now?: () => number;
  /** How early to refresh the token before expiry (ms). Defaults to 5 min. */
  safetyWindowMs?: number;
}
