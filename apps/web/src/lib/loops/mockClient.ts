import logger from '@/utils/logger';

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
      logger.dev('📧 [MOCK EMAIL] Would send transactional email:', {
        template: opts.transactionalId,
        to: opts.email,
        variables: opts.dataVariables,
      });

      // Log in a user-friendly format
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║                     📧 MOCK EMAIL SENT                     ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Template: ${opts.transactionalId}`);
      console.log(`║ To: ${opts.email}`);
      console.log('║ Variables:');
      if (opts.dataVariables) {
        Object.entries(opts.dataVariables).forEach(([key, value]) => {
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
