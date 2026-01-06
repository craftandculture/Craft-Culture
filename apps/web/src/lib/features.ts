/**
 * Feature flags for authentication methods.
 * These allow instant rollback if any auth feature causes issues.
 * Magic link is always enabled as the fallback - no kill switch needed.
 *
 * Set via environment variables in Vercel dashboard.
 */
const features = {
  /** Enable passkey/WebAuthn authentication */
  passkeys: true, // Hardcoded for testing - TODO: revert to env var

  /** Enable OAuth providers (Google, Microsoft, Apple) */
  oauth: process.env.NEXT_PUBLIC_FEATURE_OAUTH === 'true',

  /** Enable two-factor authentication (TOTP) */
  twoFactor: process.env.NEXT_PUBLIC_FEATURE_2FA === 'true',
} as const;

export default features;
