import {
  KomipayAuthenticationError,
} from '../errors/KomipayError';
import type { HttpClient } from '../http/HttpClient';
import type { CallSpec, KomipayEnvelope } from '../http/types';
import type { KomipayCredentials } from '../config/KomipayConfig';
import type { TokenStore } from './TokenStore';

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_SAFETY_WINDOW_MS = 5 * 60 * 1000;

/** Anything that can issue an authenticated, retried request. */
export interface Session {
  authorized<T = Record<string, unknown>>(
    spec: CallSpec,
  ): Promise<T & KomipayEnvelope<T>>;
}

export interface AuthSessionOptions {
  http: HttpClient;
  credentials: KomipayCredentials;
  store: TokenStore;
  now?: () => number;
  safetyWindowMs?: number;
}

/**
 * Owns the bearer-token lifecycle: fetch, cache (with early refresh) and
 * transparent re-authentication when a call comes back 401.
 */
export class AuthSession implements Session {
  private readonly now: () => number;
  private readonly safetyWindowMs: number;
  private inflight: Promise<string> | null = null;

  constructor(private readonly options: AuthSessionOptions) {
    this.now = options.now ?? (() => Date.now());
    this.safetyWindowMs = options.safetyWindowMs ?? DEFAULT_SAFETY_WINDOW_MS;
    this.options.http.setTokenProvider(() => this.getToken());
  }

  /** Return a valid token, refreshing early if it is close to expiring. */
  async getToken(): Promise<string> {
    const key = this.options.credentials.apiKey;
    const cached = await this.options.store.get(key);

    if (cached && this.now() < cached.expiresAt - this.safetyWindowMs) {
      return cached.value;
    }

    return this.authenticate(key);
  }

  /** Drop the cached token so the next call re-authenticates. */
  async invalidate(): Promise<void> {
    this.inflight = null;
    await this.options.store.clear(this.options.credentials.apiKey);
  }

  /**
   * Send an authenticated call. On a 401 the token is refreshed once and the
   * call retried; a second failure propagates.
   */
  async authorized<T = Record<string, unknown>>(
    spec: CallSpec,
  ): Promise<T & KomipayEnvelope<T>> {
    try {
      return await this.options.http.send<T>({ ...spec, auth: true });
    } catch (error) {
      if (error instanceof KomipayAuthenticationError) {
        await this.invalidate();
        return await this.options.http.send<T>({ ...spec, auth: true });
      }
      throw error;
    }
  }

  private authenticate(key: string): Promise<string> {
    if (!this.inflight) {
      this.inflight = this.doAuthenticate(key).finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async doAuthenticate(key: string): Promise<string> {
    const credentials = this.options.credentials;
    const envelope = await this.options.http.send<{ token?: string; expires?: string }>({
      method: 'POST',
      path: '/generateToken',
      base: 'auth',
      body: {
        login: credentials.login,
        password: credentials.password,
        api_key: credentials.apiKey,
      },
    });

    const token = envelope.token;
    if (!token) {
      throw new KomipayAuthenticationError('KomiPay did not return a token', envelope);
    }

    const expiresAt = this.now() + parseExpiry(envelope.expires);
    await this.options.store.set(key, { value: token, expiresAt });
    return token;
  }
}

/** Parse KomiPay's human-readable expiry (e.g. "30 minutes") into ms. */
export function parseExpiry(value?: string): number {
  if (!value) return DEFAULT_TTL_MS;

  const match = /([\d.]+)\s*(milliseconds?|ms|seconds?|secs?|sec|minutes?|mins?|min|hours?|hrs?|hr|h)?/i.exec(
    value,
  );
  const amount = match ? Number.parseFloat(match[1] ?? '') : NaN;
  if (!Number.isFinite(amount)) return DEFAULT_TTL_MS;

  const unit = (match?.[2] ?? 'minutes').toLowerCase();
  if (unit.startsWith('ms') || unit.startsWith('milli')) return amount;
  if (unit.startsWith('sec')) return amount * 1000;
  if (unit.startsWith('hour') || unit === 'h' || unit.startsWith('hr')) {
    return amount * 60 * 60 * 1000;
  }
  return amount * 60 * 1000;
}
