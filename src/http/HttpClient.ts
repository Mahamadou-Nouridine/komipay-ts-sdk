import {
  KomipayApiError,
  KomipayError,
  KomipayNetworkError,
  KomipayTimeoutError,
} from '../errors/KomipayError';
import type {
  CallSpec,
  Endpoints,
  FetchLike,
  KomipayEnvelope,
  KomipayResponse,
} from './types';

export interface HttpClientOptions {
  endpoints: Endpoints;
  fetch: FetchLike;
  timeout: number;
}

type TokenProvider = () => Promise<string> | string;

/**
 * Pure transport. Knows how to build a URL, attach the bearer token, enforce a
 * timeout and translate failures into typed errors — nothing about KomiPay's
 * business rules. Resources own the business logic.
 */
export class HttpClient {
  private tokenProvider: TokenProvider | null = null;

  constructor(private readonly options: HttpClientOptions) {}

  /** Registered by the AuthSession so `auth:true` calls get a fresh token. */
  setTokenProvider(provider: TokenProvider): void {
    this.tokenProvider = provider;
  }

  async send<T = Record<string, unknown>>(
    spec: CallSpec,
  ): Promise<T & KomipayEnvelope<T>> {
    const root =
      spec.base === 'auth' ? this.options.endpoints.authRoot : this.options.endpoints.apiBase;
    const url = `${root}${spec.path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(spec.headers ?? {}),
    };

    if (spec.auth) {
      const token = this.tokenProvider ? await this.tokenProvider() : null;
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const timeout = spec.timeout ?? this.options.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: KomipayResponse;
    try {
      response = await this.options.fetch(url, {
        method: spec.method,
        headers,
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new KomipayTimeoutError(`Request timed out after ${timeout}ms`, error);
      }
      throw new KomipayNetworkError(
        (error as Error)?.message ?? 'Network request failed',
        error,
      );
    } finally {
      clearTimeout(timer);
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const error = KomipayError.fromEnvelope(body, response.status);
    if (error && !spec.allowFailure) {
      throw error;
    }

    if (!body || typeof body !== 'object') {
      throw new KomipayApiError(
        response.status,
        `Unexpected response (HTTP ${response.status})`,
        false,
        body,
      );
    }

    return body as T & KomipayEnvelope<T>;
  }
}
