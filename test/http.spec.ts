import { describe, it, expect } from 'vitest';
import {
  HttpClient,
  resolveEndpoints,
  Environment,
  KomipayValidationError,
  KomipayAuthenticationError,
  KomipayApiError,
  KomipayNetworkError,
  KomipayTimeoutError,
} from '../src';
import { makeFetch, jsonResponse } from './fixtures';

const endpoints = resolveEndpoints(Environment.Sandbox);

function client(fetchImpl: any, token?: string) {
  const http = new HttpClient({ endpoints, fetch: fetchImpl, timeout: 30_000 });
  if (token !== undefined) http.setTokenProvider(() => token);
  return http;
}

describe('resolveEndpoints', () => {
  it('sandbox points at the 8181 host', () => {
    expect(endpoints.authRoot).toBe(
      'http://sandbox.komipay.com:8181/APIs/mobile_money.php',
    );
    expect(endpoints.apiBase).toBe(
      'http://sandbox.komipay.com:8181/APIs/mobile_money.php/customers-api-kp/v1',
    );
  });

  it('live points at the https host', () => {
    const live = resolveEndpoints(Environment.Live);
    expect(live.authRoot).toBe('https://www.komipay.com/APIs/mobile_money.php');
    expect(live.apiBase).toBe(
      'https://www.komipay.com/APIs/mobile_money.php/customers-api-kp/v1',
    );
  });
});

describe('HttpClient', () => {
  it('POSTs JSON to the api base by default', async () => {
    const rec = makeFetch([jsonResponse(200, { code: 200, statut: true })]);
    const http = client(rec.fetch);

    const env = await http.send({ method: 'POST', path: '/b2c_standard', body: { a: 1 } });

    expect(env.statut).toBe(true);
    expect(rec.calls[0].url).toBe(`${endpoints.apiBase}/b2c_standard`);
    expect(rec.calls[0].init.method).toBe('POST');
    expect((rec.calls[0].init.headers as any)['Content-Type']).toBe('application/json');
    expect(rec.bodyOf(0)).toEqual({ a: 1 });
  });

  it('uses the auth root when base is "auth"', async () => {
    const rec = makeFetch([jsonResponse(200, { code: 200, statut: true })]);
    const http = client(rec.fetch);
    await http.send({ method: 'POST', path: '/generateToken', base: 'auth', body: {} });
    expect(rec.calls[0].url).toBe(`${endpoints.authRoot}/generateToken`);
  });

  it('injects the bearer token when auth is requested', async () => {
    const rec = makeFetch([jsonResponse(200, { code: 200, statut: true })]);
    const http = client(rec.fetch, 'tok_123');
    await http.send({ method: 'POST', path: '/x', auth: true, body: {} });
    expect((rec.calls[0].init.headers as any).Authorization).toBe('Bearer tok_123');
  });

  it('omits Authorization when auth is not requested', async () => {
    const rec = makeFetch([jsonResponse(200, { code: 200, statut: true })]);
    const http = client(rec.fetch, 'tok_123');
    await http.send({ method: 'POST', path: '/x', body: {} });
    expect((rec.calls[0].init.headers as any).Authorization).toBeUndefined();
  });

  it('merges caller headers such as keypass', async () => {
    const rec = makeFetch([jsonResponse(200, { code: 200, statut: true })]);
    const http = client(rec.fetch, 'tok');
    await http.send({
      method: 'POST',
      path: '/crypt-cvv',
      auth: true,
      headers: { keypass: 'kp_1' },
      body: {},
    });
    expect((rec.calls[0].init.headers as any).keypass).toBe('kp_1');
  });

  it('throws ValidationError for a statut:false 400 body', async () => {
    const rec = makeFetch([jsonResponse(200, { code: 400, statut: false, message: 'ko' })]);
    await expect(client(rec.fetch).send({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(
      KomipayValidationError,
    );
  });

  it('throws AuthenticationError on HTTP 401', async () => {
    const rec = makeFetch([jsonResponse(401, { code: 401, statut: false, message: 'nope' })]);
    await expect(client(rec.fetch).send({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(
      KomipayAuthenticationError,
    );
  });

  it('throws ApiError on HTTP 500', async () => {
    const rec = makeFetch([jsonResponse(500, { code: 500, statut: false, message: 'server' })]);
    await expect(client(rec.fetch).send({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(
      KomipayApiError,
    );
  });

  it('maps an AbortError to TimeoutError', async () => {
    const rec = makeFetch(() => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    await expect(client(rec.fetch).send({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(
      KomipayTimeoutError,
    );
  });

  it('maps a fetch TypeError to NetworkError', async () => {
    const rec = makeFetch(() => {
      throw new TypeError('fetch failed');
    });
    await expect(client(rec.fetch).send({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(
      KomipayNetworkError,
    );
  });

  it('returns the raw envelope when allowFailure is set', async () => {
    const rec = makeFetch([
      jsonResponse(400, { code: 400, statut: false, message: 'Echec', data: { transactionStatus: 'Echec' } }),
    ]);
    const env = await client(rec.fetch).send<any>({
      method: 'POST',
      path: '/check-transaction-status',
      body: {},
      allowFailure: true,
    });
    expect(env.statut).toBe(false);
    expect(env.data.transactionStatus).toBe('Echec');
  });
});
