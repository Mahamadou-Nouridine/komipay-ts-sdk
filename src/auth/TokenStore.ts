/** A cached bearer token with its absolute expiry (epoch ms). */
export interface StoredToken {
  value: string;
  expiresAt: number;
}

/**
 * Pluggable token cache. The default is in-memory; a backend can supply a
 * Redis/DB-backed implementation so tokens survive restarts and are shared
 * across workers.
 */
export interface TokenStore {
  get(key: string): Promise<StoredToken | undefined>;
  set(key: string, token: StoredToken): Promise<void>;
  clear(key: string): Promise<void>;
}
