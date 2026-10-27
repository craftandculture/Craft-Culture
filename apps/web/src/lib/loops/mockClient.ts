import logger from '@/utils/logger';

/** Variables that may carry a sign-in link or one-time code */
const SENSITIVE_KEY = /url|link|token|code|otp|secret|password/i;

/**
 * Template variables safe to print: anything that could be a magic link,
 * token or code is replaced, so console and Vercel logs never hold a working
 * sign-in link
 */
const redactVariables = (variables: Record<string, unknown> | undefined) =>
  variables
    ? Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [
          key,
          SENSITIVE_KEY.test(key) || (typeof value === 'string' && /token=|https?:\/\//i.test(value))
            ? '[redacted]'
            : value,
        ]),
      )
    : undefined;

/**
 * Mock Loops client for development/testing
 *
 * Logs email details to console instead of sending actual emails
 * Useful for local development and testing email flows
 */
const createMockLoopsClient = () => {
  return {
    sendTransactionalEmail: async (options: unknown) => {
      const opts = options as {
        transactionalId: string;
        email: string;
        dataVariables?: Record<string, unknown>;
      };
      const variables = redactVariables(opts.dataVariables);

      logger.dev('📧 [MOCK EMAIL] Would send transactional email:', {
        template: opts.transactionalId,
        to: opts.email,
        variables,
      });

      // Log in a user-friendly format
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║                     📧 MOCK EMAIL SENT                     ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Template: ${opts.transactionalId}`);
      console.log(`║ To: ${opts.email}`);
      console.log('║ Variables:');
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          console.log(`║   - ${key}: ${value}`);
        });
      }
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      return {
        success: true,
        transactionalId: opts.transactionalId,
      } as never;
    },
  };
};

export default createMockLoopsClient;
