import { describe, it, expect, vi } from 'vitest';
import {
  AuthSession,
  HttpClient,
  MemoryTokenStore,
  resolveEndpoints,
  Environment,
  KomipayCredentials,
  KomipayAuthenticationError,
} from '../src';
import { makeFetch, jsonResponse } from './fixtures';

const endpoints = resolveEndpoints(Environment.Sandbox);
const credentials: KomipayCredentials = {
  apiKey: 'api_123',
  login: 'merchant@x.com',
  password: 'secret',
};

const tokenResponse = (token = 'tok_abc', expires = '30 minutes') =>
  jsonResponse(200, {
    code: 200,
    statut: true,
    message: 'Token généré avec succès',
    token,
    expires,
  });

function makeSession(
  fetchImpl: any,
  opts: { now?: () => number; safetyWindowMs?: number; store?: MemoryTokenStore } = {},
) {
  const http = new HttpClient({ endpoints, fetch: fetchImpl, timeout: 30_000 });
  const store = opts.store ?? new MemoryTokenStore();
  const session = new AuthSession({
    http,
    credentials,
    store,
    now: opts.now,
    safetyWindowMs: opts.safetyWindowMs,
  });
  return { session, store, http };
}

describe('MemoryTokenStore', () => {
  it('stores, reads and clears tokens by key', async () => {
    const store = new MemoryTokenStore();
    expect(await store.get('k')).toBeUndefined();
    await store.set('k', { value: 'v', expiresAt: 123 });
    expect(await store.get('k')).toEqual({ value: 'v', expiresAt: 123 });
    await store.clear('k');
    expect(await store.get('k')).toBeUndefined();
  });
});

describe('AuthSession', () => {
  it('authenticates with login/password/api_key and no Authorization header', async () => {
    const rec = makeFetch([tokenResponse('tok_1')]);
    const { session } = makeSession(rec.fetch);

    await expect(session.getToken()).resolves.toBe('tok_1');

    expect(rec.calls[0].url).toBe(`${endpoints.authRoot}/generateToken`);
    expect(rec.bodyOf(0)).toEqual({
      login: 'merchant@x.com',
      password: 'secret',
      api_key: 'api_123',
    });
    expect((rec.calls[0].init.headers as any).Authorization).toBeUndefined();
  });

  it('caches the token so a second call needs no network', async () => {
    const rec = makeFetch([tokenResponse('tok_1')]);
    const { session } = makeSession(rec.fetch);

    await session.getToken();
    await session.getToken();

    expect(rec.calls).toHaveLength(1);
  });

  it('persists the token in the provided store keyed by api key', async () => {
    const store = new MemoryTokenStore();
    const rec = makeFetch([tokenResponse('tok_1')]);
    const { session } = makeSession(rec.fetch, { store, now: () => 0 });

    await session.getToken();

    const cached = await store.get('api_123');
    expect(cached?.value).toBe('tok_1');
    expect(cached?.expiresAt).toBe(30 * 60 * 1000);
  });

  it('re-authenticates once the token expires', async () => {
    let clock = 0;
    const rec = makeFetch([tokenResponse('tok_1'), tokenResponse('tok_2')]);
    const { session } = makeSession(rec.fetch, { now: () => clock });

    expect(await session.getToken()).toBe('tok_1');
    clock = 31 * 60 * 1000;
    expect(await session.getToken()).toBe('tok_2');
    expect(rec.calls).toHaveLength(2);
  });

  it('refreshes early within the safety window', async () => {
    let clock = 0;
    const rec = makeFetch([tokenResponse('tok_1'), tokenResponse('tok_2')]);
    const { session } = makeSession(rec.fetch, {
      now: () => clock,
      safetyWindowMs: 5 * 60 * 1000,
    });

    await session.getToken();
    clock = 26 * 60 * 1000; // 30 - 5 = 25 min mark crossed
    await session.getToken();
    expect(rec.calls).toHaveLength(2);
  });

  it('invalidate clears the cache and forces re-auth', async () => {
    const store = new MemoryTokenStore();
    const rec = makeFetch([tokenResponse('tok_1'), tokenResponse('tok_2')]);
    const { session } = makeSession(rec.fetch, { store });

    await session.getToken();
    await session.invalidate();
    expect(await store.get('api_123')).toBeUndefined();
    expect(await session.getToken()).toBe('tok_2');
  });

  it('surfaces a 401 during authentication as AuthenticationError', async () => {
    const rec = makeFetch([
      jsonResponse(401, { code: 401, statut: false, message: 'Identifiants invalides' }),
    ]);
    const { session } = makeSession(rec.fetch);
    await expect(session.getToken()).rejects.toBeInstanceOf(KomipayAuthenticationError);
  });

  describe('authorized', () => {
    it('attaches the bearer and returns the envelope', async () => {
      const rec = makeFetch([
        tokenResponse('tok_1'),
        jsonResponse(200, { code: 200, statut: true, message: 'ok', reference_transaction: 'R1' }),
      ]);
      const { session } = makeSession(rec.fetch);

      const env = await session.authorized<any>({ method: 'POST', path: '/b2c_standard', body: {} });

      expect(env.reference_transaction).toBe('R1');
      expect((rec.calls[1].init.headers as any).Authorization).toBe('Bearer tok_1');
    });

    it('re-authenticates exactly once on a 401 then retries', async () => {
      const rec = makeFetch([
        tokenResponse('tok_1'), // initial auth
        jsonResponse(401, { code: 401, statut: false, message: 'expired' }), // first api call
        tokenResponse('tok_2'), // re-auth
        jsonResponse(200, { code: 200, statut: true, message: 'ok' }), // retry
      ]);
      const { session } = makeSession(rec.fetch);

      const env = await session.authorized<any>({ method: 'POST', path: '/b2c_standard', body: {} });

      expect(env.statut).toBe(true);
      expect(rec.calls).toHaveLength(4);
      expect((rec.calls[3].init.headers as any).Authorization).toBe('Bearer tok_2');
    });

    it('throws when the retry also fails', async () => {
      const rec = makeFetch([
        tokenResponse('tok_1'),
        jsonResponse(401, { code: 401, statut: false, message: 'expired' }),
        tokenResponse('tok_2'),
        jsonResponse(401, { code: 401, statut: false, message: 'still bad' }),
      ]);
      const { session } = makeSession(rec.fetch);

      await expect(
        session.authorized<any>({ method: 'POST', path: '/b2c_standard', body: {} }),
      ).rejects.toBeInstanceOf(KomipayAuthenticationError);
    });

    it('does not retry on non-auth errors', async () => {
      const rec = makeFetch([
        tokenResponse('tok_1'),
        jsonResponse(400, { code: 400, statut: false, message: 'bad request' }),
      ]);
      const { session } = makeSession(rec.fetch);

      await expect(
        session.authorized<any>({ method: 'POST', path: '/b2c_standard', body: {} }),
      ).rejects.toBeInstanceOf(Error);
      expect(rec.calls).toHaveLength(2);
    });
  });
});
