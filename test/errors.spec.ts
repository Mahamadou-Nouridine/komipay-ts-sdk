import { describe, it, expect } from 'vitest';
import {
  KomipayError,
  KomipayErrorKind,
  KomipayAuthenticationError,
  KomipayValidationError,
  KomipayApiError,
  KomipayNetworkError,
  KomipayTimeoutError,
} from '../src';

describe('errors', () => {
  it('every error extends KomipayError which extends Error', () => {
    const errors = [
      new KomipayAuthenticationError('x'),
      new KomipayValidationError('x'),
      new KomipayApiError(400, 'x', false, {}),
      new KomipayNetworkError('x'),
      new KomipayTimeoutError('x'),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(KomipayError);
    }
  });

  it('sets a stable name and kind per subclass', () => {
    expect(new KomipayAuthenticationError('x').kind).toBe(
      KomipayErrorKind.Authentication,
    );
    expect(new KomipayValidationError('x').kind).toBe(
      KomipayErrorKind.Validation,
    );
    expect(new KomipayApiError(400, 'x', false, {}).kind).toBe(
      KomipayErrorKind.Api,
    );
    expect(new KomipayNetworkError('x').kind).toBe(KomipayErrorKind.Network);
    expect(new KomipayTimeoutError('x').kind).toBe(KomipayErrorKind.Timeout);

    expect(new KomipayApiError(400, 'x', false, {}).name).toBe(
      'KomipayApiError',
    );
  });

  it('ApiError carries code, statut, message and raw payload', () => {
    const raw = { code: 402, statut: false, message: 'Solde insuffisant' };
    const err = new KomipayApiError(raw.code, raw.message, raw.statut, raw);
    expect(err.code).toBe(402);
    expect(err.statut).toBe(false);
    expect(err.message).toBe('Solde insuffisant');
    expect(err.raw).toBe(raw);
  });

  describe('fromEnvelope', () => {
    it('returns null for a healthy success envelope', () => {
      expect(
        KomipayError.fromEnvelope({ code: 200, statut: true, message: 'ok' }, 200),
      ).toBeNull();
    });

    it('maps a statut:false code 400 body to ValidationError', () => {
      const err = KomipayError.fromEnvelope(
        { code: 400, statut: false, message: 'Paramètre manquant' },
        200,
      );
      expect(err).toBeInstanceOf(KomipayValidationError);
      expect(err?.message).toBe('Paramètre manquant');
    });

    it('maps a 401 body to AuthenticationError', () => {
      const err = KomipayError.fromEnvelope(
        { code: 401, statut: false, message: 'Clé invalide' },
        200,
      );
      expect(err).toBeInstanceOf(KomipayAuthenticationError);
    });

    it('maps a 4xx statut:false with other code to ApiError', () => {
      const err = KomipayError.fromEnvelope(
        { code: 402, statut: false, message: 'Refusé' },
        200,
      );
      expect(err).toBeInstanceOf(KomipayApiError);
      expect((err as KomipayApiError).code).toBe(402);
    });

    it('prioritises HTTP 401 even when the body claims success', () => {
      const err = KomipayError.fromEnvelope(
        { code: 200, statut: true, message: 'ok' },
        401,
      );
      expect(err).toBeInstanceOf(KomipayAuthenticationError);
    });

    it('maps HTTP 5xx to ApiError carrying the http code', () => {
      const err = KomipayError.fromEnvelope(
        { code: 200, statut: true, message: 'ok' },
        500,
      );
      expect(err).toBeInstanceOf(KomipayApiError);
      expect((err as KomipayApiError).code).toBe(500);
    });

    it('maps a non-object body to ApiError', () => {
      const err = KomipayError.fromEnvelope(null, 502);
      expect(err).toBeInstanceOf(KomipayApiError);
      expect((err as KomipayApiError).code).toBe(502);
    });
  });
});
