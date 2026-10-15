import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  normalizePhone,
  formatCardNumber,
  challengeWindowSizeFor,
  browserFingerprint,
  ChallengeWindowSize,
  KomipayValidationError,
} from '../src';

describe('formatAmount', () => {
  it('strips thousands separators', () => {
    expect(formatAmount('10 000')).toBe('10000');
    expect(formatAmount('5 000')).toBe('5000');
    expect(formatAmount('1 234 567')).toBe('1234567');
  });

  it('accepts numbers and numeric strings', () => {
    expect(formatAmount(5000)).toBe('5000');
    expect(formatAmount('5000')).toBe('5000');
  });

  it('rejects non-positive, non-integer and non-numeric values', () => {
    for (const bad of ['abc', '0', '-5', '10.5', '', '  ']) {
      expect(() => formatAmount(bad)).toThrow(KomipayValidationError);
    }
  });
});

describe('normalizePhone', () => {
  it('prefixes the country calling code', () => {
    expect(normalizePhone('96 00 11 22', 'NE')).toBe('+22796001122');
    expect(normalizePhone('96001122', 'BJ')).toBe('+22996001122');
  });

  it('is idempotent when the code is already present', () => {
    expect(normalizePhone('22796001122', 'NE')).toBe('+22796001122');
    expect(normalizePhone('+22796001122', 'NE')).toBe('+22796001122');
  });

  it('strips international 00 prefix', () => {
    expect(normalizePhone('0022796001122', 'NE')).toBe('+22796001122');
  });

  it('throws for unknown country or empty input', () => {
    expect(() => normalizePhone('96001122', 'ZZ')).toThrow(KomipayValidationError);
    expect(() => normalizePhone('', 'NE')).toThrow(KomipayValidationError);
  });
});

describe('formatCardNumber', () => {
  it('groups digits in blocks of four separated by dashes', () => {
    expect(formatCardNumber('4012001037141112')).toBe('4012-0010-3714-1112');
    expect(formatCardNumber('4012-0010-3714-1112')).toBe('4012-0010-3714-1112');
    expect(formatCardNumber('4012 0010 3714 1112')).toBe('4012-0010-3714-1112');
  });
});

describe('challengeWindowSizeFor', () => {
  it('maps dimensions to the documented 3DS codes', () => {
    expect(challengeWindowSizeFor(250, 400)).toBe(ChallengeWindowSize.W250x400);
    expect(challengeWindowSizeFor(390, 400)).toBe(ChallengeWindowSize.W390x400);
    expect(challengeWindowSizeFor(500, 600)).toBe(ChallengeWindowSize.W500x600);
    expect(challengeWindowSizeFor(600, 400)).toBe(ChallengeWindowSize.W600x400);
    expect(challengeWindowSizeFor(1536, 960)).toBe(ChallengeWindowSize.Fullscreen);
  });
});

describe('browserFingerprint', () => {
  it('builds the fingerprint payload from the environment', () => {
    const fp = browserFingerprint({
      screen: { width: 1536, height: 960 },
      navigator: { javaEnabled: () => false },
      timezoneOffset: () => -60,
    });

    expect(fp).toEqual({
      javaEnabled: false,
      javascriptEnabled: true,
      screenHeight: '960',
      screenWidth: '1536',
      TZ: '1',
      challengeWindowSize: ChallengeWindowSize.Fullscreen,
    });
  });

  it('falls back to a full-screen window when no source is given', () => {
    const fp = browserFingerprint();
    expect(fp.challengeWindowSize).toBeDefined();
    expect(typeof fp.screenWidth).toBe('string');
  });
});
