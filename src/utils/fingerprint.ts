import { ChallengeWindowSize } from '../models/enums';

/** Payer-environment data required by the B2C card (3DS) endpoint. */
export interface Fingerprint {
  javaEnabled: boolean;
  javascriptEnabled: boolean;
  screenHeight: string;
  screenWidth: string;
  TZ: string;
  challengeWindowSize: ChallengeWindowSize;
}

export interface FingerprintSource {
  screen?: { width: number; height: number };
  navigator?: { javaEnabled?: () => boolean };
  /** Timezone offset in minutes, as returned by `Date.getTimezoneOffset()`. */
  timezoneOffset?: () => number;
}

/** Map screen dimensions to KomiPay's accepted 3DS challenge window codes. */
export function challengeWindowSizeFor(
  width: number,
  height: number,
): ChallengeWindowSize {
  if (width <= 250 && height <= 400) return ChallengeWindowSize.W250x400;
  if (width <= 390 && height <= 400) return ChallengeWindowSize.W390x400;
  if (width <= 500 && height <= 600) return ChallengeWindowSize.W500x600;
  if (width <= 600 && height <= 400) return ChallengeWindowSize.W600x400;
  return ChallengeWindowSize.Fullscreen;
}

/**
 * Build the device/browser fingerprint. Works in the browser out of the box;
 * pass an explicit `source` in tests or non-browser runtimes.
 */
export function browserFingerprint(source: FingerprintSource = {}): Fingerprint {
  const screen =
    source.screen ?? ((globalThis as { screen?: { width: number; height: number } }).screen) ?? {
      width: 1920,
      height: 1080,
    };
  const navigator =
    source.navigator ??
    ((globalThis as { navigator?: { javaEnabled?: () => boolean } }).navigator) ??
    {};

  const javaEnabled =
    typeof navigator.javaEnabled === 'function' ? Boolean(navigator.javaEnabled()) : false;
  const offset =
    typeof source.timezoneOffset === 'function'
      ? source.timezoneOffset()
      : new Date().getTimezoneOffset();

  return {
    javaEnabled,
    javascriptEnabled: true,
    screenHeight: String(screen.height),
    screenWidth: String(screen.width),
    TZ: String(-(offset / 60)),
    challengeWindowSize: challengeWindowSizeFor(screen.width, screen.height),
  };
}
