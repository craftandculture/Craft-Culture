import { adminProcedure } from '@/lib/trpc/procedures';
import { getAccessToken, isZohoConfigured, zohoFetch } from '@/lib/zoho/client';

/**
 * Check Zoho API connectivity by verifying configuration,
 * refreshing the token, and making a test API call.
 *
 * @returns Zoho health status with configuration and connectivity info
 */
const adminHealthCheckZoho = adminProcedure.query(async () => {
  const configured = isZohoConfigured();

  if (!configured) {
    return {
      status: 'not_configured' as const,
      configured: false,
      tokenValid: false,
      apiReachable: false,
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const start = performance.now();

  // Step 1: Test token refresh
  let tokenValid = false;
  try {
    await getAccessToken();
    tokenValid = true;
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: 'token_error' as const,
      configured: true,
      tokenValid: false,
      apiReachable: false,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  // Step 2: Test API call (fetch organization info - lightweight)
  let apiReachable = false;
  try {
    await zohoFetch<{ code: number }>('/organization');
    apiReachable = true;
  } catch {
    // Token works but API call failed
  }

  const latencyMs = Math.round(performance.now() - start);

  return {
    status: apiReachable ? ('connected' as const) : ('api_error' as const),
    configured: true,
    tokenValid,
    apiReachable,
    latencyMs,
    timestamp: new Date().toISOString(),
  };
});

export default adminHealthCheckZoho;
