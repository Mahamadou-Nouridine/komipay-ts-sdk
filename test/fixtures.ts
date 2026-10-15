import { vi } from 'vitest';
import type {
  FetchLike,
  KomipayResponse,
  CallSpec,
  KomipayEnvelope,
} from '../src';

/** Build a Response-like object the transport understands. */
export function jsonResponse(status: number, body: unknown): KomipayResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

export function textResponse(status: number, text: string): KomipayResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

export interface FetchRecorder {
  fetch: FetchLike;
  calls: { url: string; init: Record<string, unknown> }[];
  bodyOf: (index: number) => any;
}

/**
 * A scripted fetch: pass a queue of responses (or a function per call).
 * Records every call so tests can assert URL, headers and body.
 */
export function makeFetch(
  handler:
    | KomipayResponse[]
    | ((url: string, init: any, callIndex: number) => KomipayResponse | Promise<KomipayResponse>),
): FetchRecorder {
  const calls: { url: string; init: Record<string, unknown> }[] = [];
  let index = 0;

  const fetchImpl: FetchLike = (async (url: string, init?: any) => {
    const callIndex = index++;
    calls.push({ url, init: init ?? {} });
    if (typeof handler === 'function') return handler(url, init, callIndex);
    const next = handler[callIndex];
    if (!next) throw new Error(`No scripted response for call #${callIndex + 1}`);
    return next;
  }) as FetchLike;

  return {
    fetch: fetchImpl,
    calls,
    bodyOf: (i: number) => {
      const body = calls[i]?.init?.body;
      return typeof body === 'string' ? JSON.parse(body) : body;
    },
  };
}

export function failsWith(name: string, message = 'boom'): () => never {
  return () => {
    const err = new Error(message);
    err.name = name;
    throw err;
  };
}

/** A fake auth session that records every authorized() spec. */
export interface SessionRecorder {
  session: { authorized: <T>(spec: CallSpec) => Promise<T & KomipayEnvelope<T>> };
  calls: CallSpec[];
  callsFor: (path: string) => CallSpec[];
}

export function makeSession(
  responder: (spec: CallSpec, callIndex: number) => KomipayEnvelope<any> | Promise<KomipayEnvelope<any>>,
): SessionRecorder {
  const calls: CallSpec[] = [];
  let index = 0;
  const authorized = vi.fn(async (spec: CallSpec) => {
    calls.push(spec);
    return responder(spec, index++);
  });
  return {
    session: { authorized: authorized as any },
    calls,
    callsFor: (path) => calls.filter((c) => c.path === path),
  };
}

export function okEnvelope<T extends object>(extra: T = {} as T): KomipayEnvelope<any> {
  return {
    code: 200,
    statut: true,
    message: 'Operation successful',
    ...extra,
  } as KomipayEnvelope<any>;
}
