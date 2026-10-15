import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  CollectionsFor,
  TransfersFor,
  CollectionsResource,
  AggregatorResource,
} from '../src';
import {
  Komipay,
  Environment,
  Profile,
  Channel,
  KomipayProfileError,
} from '../src';
import { makeFetch, jsonResponse, okEnvelope } from './fixtures';

const credentials = { apiKey: 'api_123', login: 'm@x.com', password: 'secret', keypass: 'kp_1' };

describe('Komipay facade', () => {
  it('defaults to sandbox + business and exposes the resolved endpoints', () => {
    const komipay = new Komipay({ credentials });
    expect(komipay.environment).toBe(Environment.Sandbox);
    expect(komipay.profile).toBe(Profile.Business);
    expect(komipay.endpoints.authRoot).toContain('sandbox.komipay.com:8181');
  });

  it('honours an explicit environment and profile', () => {
    const komipay = new Komipay({
      credentials,
      environment: Environment.Live,
      profile: Profile.Aggregator,
    });
    expect(komipay.environment).toBe(Environment.Live);
    expect(komipay.endpoints.apiBase).toContain('www.komipay.com');
  });

  describe('profile gating', () => {
    it('business can use gateway, collections and transactions', () => {
      const komipay = new Komipay({ credentials, profile: Profile.Business });
      expect(komipay.gateway).toBeDefined();
      expect(komipay.collections).toBeDefined();
      expect(komipay.transactions).toBeDefined();
    });

    it('business cannot use B2B transfers', () => {
      const komipay = new Komipay({ credentials, profile: Profile.Business });
      expect(() => komipay.transfers).toThrow(KomipayProfileError);
      expect(() => komipay.transfers).toThrow(/aggregateur/i);
    });

    it('aggregator can use transfers but not B2C collections', () => {
      const komipay = new Komipay({ credentials, profile: Profile.Aggregator });
      expect(komipay.transfers).toBeDefined();
      expect(() => komipay.collections).toThrow(KomipayProfileError);
      expect(() => komipay.collections).toThrow(/entreprise/i);
    });
  });

  it('wires the whole flow end-to-end: auth then resource call', async () => {
    const rec = makeFetch([
      jsonResponse(200, {
        code: 200,
        statut: true,
        message: 'Token généré avec succès',
        token: 'tok_1',
        expires: '30 minutes',
      }),
      jsonResponse(200, okEnvelope({ reference_transaction: 'RT_E2E' })),
    ]);

    const komipay = new Komipay({ credentials, fetch: rec.fetch });

    const result = await komipay.collections.payWithMobileMoney({
      channel: Channel.AirtelMoney,
      amount: '5 000',
      phone: '96001122',
      country: 'NE',
      payerName: 'Jane',
      externalReference: 'INV-1',
    });

    expect(result.reference).toBe('RT_E2E');
    expect(rec.calls[0].url).toBe(
      'http://sandbox.komipay.com:8181/APIs/mobile_money.php/generateToken',
    );
    expect(rec.calls[1].url).toBe(
      'http://sandbox.komipay.com:8181/APIs/mobile_money.php/customers-api-kp/v1/b2c_standard',
    );
    expect((rec.calls[1].init.headers as any).Authorization).toBe('Bearer tok_1');
  });
});

describe('profile type narrowing (compile-time)', () => {
  it('maps each profile to the right resource types', () => {
    expectTypeOf<CollectionsFor<typeof Profile.Business>>().toEqualTypeOf<CollectionsResource>();
    expectTypeOf<TransfersFor<typeof Profile.Business>>().toEqualTypeOf<never>();
    expectTypeOf<TransfersFor<typeof Profile.Aggregator>>().toEqualTypeOf<AggregatorResource>();
    expectTypeOf<CollectionsFor<typeof Profile.Aggregator>>().toEqualTypeOf<never>();
  });
});
