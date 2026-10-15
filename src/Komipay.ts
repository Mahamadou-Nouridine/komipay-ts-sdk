import { AuthSession } from './auth/AuthSession';
import { MemoryTokenStore } from './auth/MemoryTokenStore';
import type { KomipayConfig, KomipayCredentials } from './config/KomipayConfig';
import { KomipayProfileError } from './errors/KomipayError';
import { HttpClient } from './http/HttpClient';
import { resolveEndpoints } from './http/resolveEndpoints';
import type { Endpoints, FetchLike } from './http/types';
import { Environment, Profile } from './models/enums';
import { AggregatorResource } from './resources/AggregatorResource';
import { CollectionsResource } from './resources/CollectionsResource';
import { GatewayResource } from './resources/GatewayResource';
import { TransactionsResource } from './resources/TransactionsResource';

/**
 * Resolves to the collections resource for a Business client, `never` for an
 * Aggregator client (and the resource again when the profile is the broad
 * `Profile` union, so untyped usage keeps working).
 */
export type CollectionsFor<P extends Profile> = P extends Profile.Aggregator
  ? never
  : CollectionsResource;

/** Mirror of {@link CollectionsFor} for the B2B transfers resource. */
export type TransfersFor<P extends Profile> = P extends Profile.Business
  ? never
  : AggregatorResource;

/**
 * Top-level facade. Wire it once, then use the profile-appropriate resources:
 *
 * - `Business`   → `gateway`, `collections`, `transactions`
 * - `Aggregator` → `gateway`, `transfers`, `transactions`
 *
 * The class is parameterised by the profile. Construct it with a literal
 * profile (`{ profile: Profile.Aggregator }`) and TypeScript makes the matching
 * resource `never` on the other side — so mismatched access fails at compile
 * time. At runtime a `KomipayProfileError` with a descriptive message is thrown
 * instead.
 */
export class Komipay<P extends Profile = Profile> {
  readonly environment: Environment;
  readonly profile: Profile;
  readonly endpoints: Endpoints;

  private readonly credentials: KomipayCredentials;
  private readonly session: AuthSession;

  private gatewayResource?: GatewayResource;
  private collectionsResource?: CollectionsResource;
  private aggregatorResource?: AggregatorResource;
  private transactionsResource?: TransactionsResource;

  constructor(config: KomipayConfig<P>) {
    if (!config?.credentials?.apiKey) {
      throw new KomipayProfileError('A KomiPay api_key is required');
    }

    this.environment = config.environment ?? Environment.Sandbox;
    this.profile = config.profile ?? Profile.Business;
    this.credentials = config.credentials;
    this.endpoints = resolveEndpoints(this.environment);

    const fetchImpl = config.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
    if (!fetchImpl) {
      throw new Error(
        'No fetch implementation found. Provide `fetch` in the config for older runtimes.',
      );
    }

    const http = new HttpClient({
      endpoints: this.endpoints,
      fetch: fetchImpl,
      timeout: config.timeout ?? 30_000,
    });

    this.session = new AuthSession({
      http,
      credentials: this.credentials,
      store: config.tokenStore ?? new MemoryTokenStore(),
      now: config.now,
      safetyWindowMs: config.safetyWindowMs,
    });
  }

  /** Guichet-KomiPay hosted terminal — available to every profile. */
  get gateway(): GatewayResource {
    return (this.gatewayResource ??= new GatewayResource(this.session, this.credentials));
  }

  /** B2C collections — Business profile only (compile-time `never` otherwise). */
  get collections(): CollectionsFor<P> {
    if (this.profile !== Profile.Business) {
      throw new KomipayProfileError(
        `B2C collections are only available on the "entreprise" (Business) profile; ` +
          `this client uses "${this.profile}". Create it with { profile: Profile.Business } ` +
          `to collect card / mobile-money / transfer payments.`,
      );
    }
    return (this.collectionsResource ??= new CollectionsResource(
      this.session,
      this.credentials,
    )) as CollectionsFor<P>;
  }

  /** B2B transfers — Aggregator profile only (compile-time `never` otherwise). */
  get transfers(): TransfersFor<P> {
    if (this.profile !== Profile.Aggregator) {
      throw new KomipayProfileError(
        `B2B transfers are only available on the "aggregateur" (Aggregator) profile; ` +
          `this client uses "${this.profile}". Create it with { profile: Profile.Aggregator } ` +
          `to send transfers between parties.`,
      );
    }
    return (this.aggregatorResource ??= new AggregatorResource(
      this.session,
      this.credentials,
    )) as TransfersFor<P>;
  }

  /** Transaction status — available to every profile. */
  get transactions(): TransactionsResource {
    return (this.transactionsResource ??= new TransactionsResource(this.session, this.credentials));
  }
}
