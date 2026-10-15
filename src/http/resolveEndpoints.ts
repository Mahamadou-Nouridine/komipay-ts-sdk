import { Environment } from '../models/enums';
import type { Endpoints } from './types';

const SANDBOX_AUTH_ROOT = 'http://sandbox.komipay.com:8181/APIs/mobile_money.php';
const LIVE_AUTH_ROOT = 'https://www.komipay.com/APIs/mobile_money.php';
const API_SUFFIX = '/customers-api-kp/v1';

/** Resolve the base URLs for a given environment. */
export function resolveEndpoints(environment: Environment): Endpoints {
  const authRoot =
    environment === Environment.Live ? LIVE_AUTH_ROOT : SANDBOX_AUTH_ROOT;
  return { authRoot, apiBase: `${authRoot}${API_SUFFIX}` };
}
