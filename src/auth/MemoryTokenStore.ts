import type { StoredToken, TokenStore } from './TokenStore';

/** Default, dependency-free in-memory token store. */
export class MemoryTokenStore implements TokenStore {
  private readonly tokens = new Map<string, StoredToken>();

  async get(key: string): Promise<StoredToken | undefined> {
    return this.tokens.get(key);
  }

  async set(key: string, token: StoredToken): Promise<void> {
    this.tokens.set(key, token);
  }

  async clear(key: string): Promise<void> {
    this.tokens.delete(key);
  }
}
