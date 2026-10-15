/** Minimal Response shape the SDK needs — keeps the transport injectable. */
export interface KomipayResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<KomipayResponse>;

/** The envelope every KomiPay endpoint wraps its payload in. */
export interface KomipayEnvelope<T = Record<string, unknown>> {
  code: number;
  statut: boolean;
  message: string;
  data?: T;
  [key: string]: unknown;
}

export interface Endpoints {
  /** Root that hosts `/generateToken`. */
  authRoot: string;
  /** Versioned base for all payment endpoints. */
  apiBase: string;
}

/** A single transport call, before auth/headers are applied. */
export interface CallSpec {
  method: 'POST' | 'GET';
  path: string;
  /** Which root to hit. Defaults to the payment API base. */
  base?: 'api' | 'auth';
  body?: unknown;
  headers?: Record<string, string>;
  /** Attach the bearer token. */
  auth?: boolean;
  /** Return the envelope even when `statut:false` (used by status polling). */
  allowFailure?: boolean;
  /** Per-call timeout override in milliseconds. */
  timeout?: number;
}
