import { KomipayCode } from '../models/enums';

export enum KomipayErrorKind {
  Authentication = 'authentication',
  Validation = 'validation',
  Api = 'api',
  Network = 'network',
  Timeout = 'timeout',
  Profile = 'profile',
}

/**
 * Base error for everything the SDK throws. Callers can `instanceof KomipayError`
 * to catch-all, or narrow to a specific subclass. `raw` always carries the last
 * provider payload for debugging/reconciliation.
 */
export abstract class KomipayError extends Error {
  abstract readonly kind: KomipayErrorKind;
  /** Best-effort provider code for display/debugging (0 when unknown). */
  readonly code: KomipayCode | number;

  constructor(message: string, readonly raw?: unknown) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
    const providerCode = (raw as { code?: unknown } | undefined)?.code;
    this.code = typeof providerCode === 'number' ? providerCode : 0;
  }

  /**
   * Normalise a KomiPay response into a typed error (or `null` when the call
   * succeeded). KomiPay mixes HTTP status with an in-body `statut:false`, so we
   * consider both.
   */
  static fromEnvelope(body: unknown, httpStatus: number): KomipayError | null {
    const envelope =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const message =
      (typeof envelope?.message === 'string' && envelope.message) ||
      `HTTP ${httpStatus}`;

    if (httpStatus === 401) {
      return new KomipayAuthenticationError(message, body);
    }
    if (httpStatus >= 500) {
      return new KomipayApiError(httpStatus, message, false, body);
    }
    if (!envelope) {
      return new KomipayApiError(
        httpStatus,
        `Unexpected response (HTTP ${httpStatus})`,
        false,
        body,
      );
    }
    if (envelope.statut === false) {
      const code =
        typeof envelope.code === 'number' ? envelope.code : httpStatus;
      if (code === KomipayCode.BadRequest) {
        return new KomipayValidationError(message, body);
      }
      if (code === KomipayCode.Unauthorized) {
        return new KomipayAuthenticationError(message, body);
      }
      return new KomipayApiError(code, message, false, body);
    }
    if (httpStatus < 200 || httpStatus >= 300) {
      return new KomipayApiError(httpStatus, message, envelope.statut === true, body);
    }
    return null;
  }
}

export class KomipayAuthenticationError extends KomipayError {
  override readonly kind = KomipayErrorKind.Authentication;
}

export class KomipayValidationError extends KomipayError {
  override readonly kind = KomipayErrorKind.Validation;
}

export class KomipayApiError extends KomipayError {
  override readonly kind = KomipayErrorKind.Api;

  constructor(
    override readonly code: number,
    message: string,
    readonly statut: boolean,
    raw?: unknown,
  ) {
    super(message, raw);
  }
}

export class KomipayNetworkError extends KomipayError {
  override readonly kind = KomipayErrorKind.Network;
}

export class KomipayTimeoutError extends KomipayError {
  override readonly kind = KomipayErrorKind.Timeout;
}

/** Thrown when an operation is used with the wrong account profile. */
export class KomipayProfileError extends KomipayError {
  override readonly kind = KomipayErrorKind.Profile;
}
