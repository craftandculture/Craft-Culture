import type { LoopsClient } from 'loops';

import logger from '@/utils/logger';

/**
 * Mock Loops client for development/testing
 *
 * Logs email details to console instead of sending actual emails
 * Useful for local development and testing email flows
 */
const createMockLoopsClient = (): Pick<LoopsClient, 'sendTransactionalEmail'> => {
  return {
    sendTransactionalEmail: async (options) => {
      logger.dev('📧 [MOCK EMAIL] Would send transactional email:', {
        template: options.transactionalId,
        to: options.email,
        variables: options.dataVariables,
      });

      // Log in a user-friendly format
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║                     📧 MOCK EMAIL SENT                     ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Template: ${options.transactionalId}`);
      console.log(`║ To: ${options.email}`);
      console.log('║ Variables:');
      if (options.dataVariables) {
        Object.entries(options.dataVariables).forEach(([key, value]) => {
          console.log(`║   - ${key}: ${value}`);
        });
      }
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      return {
        success: true,
        transactionalId: options.transactionalId,
      };
    },
  };
};

export default createMockLoopsClient;
