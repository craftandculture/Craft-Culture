/**
 * Feature flags for authentication methods.
 * These allow instant rollback if any auth feature causes issues.
 * Magic link is always enabled as the fallback - no kill switch needed.
 */
const features = {
  /** Enable passkey/WebAuthn authentication */
  passkeys: process.env.NEXT_PUBLIC_FEATURE_PASSKEYS === 'true',

  /** Enable OAuth providers (Google, Microsoft, Apple) */
  oauth: process.env.NEXT_PUBLIC_FEATURE_OAUTH === 'true',

  /** Enable two-factor authentication (TOTP) */
  twoFactor: process.env.NEXT_PUBLIC_FEATURE_2FA === 'true',
} as const;

export default features;
