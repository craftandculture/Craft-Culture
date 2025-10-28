import logger from '@/utils/logger';

/**
 * Mock Twilio client for development/testing
 *
 * Logs SMS details to console instead of sending actual messages
 * Useful for local development and testing SMS flows
 */
const createMockTwilioClient = () => {
  return {
    messages: {
      create: async (options: unknown) => {
        const opts = options as { to: string; from: string; body: string };

        logger.dev('📱 [MOCK SMS] Would send SMS:', {
          to: opts.to,
          from: opts.from,
          body: opts.body,
        });

        // Log in a user-friendly format
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                      📱 MOCK SMS SENT                          ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        console.log(`║ From: ${opts.from}`);
        console.log(`║ To: ${opts.to}`);
        console.log('║ Body:');
        const bodyLines = opts.body?.toString().split('\n') || [];
        bodyLines.forEach((line) => {
          console.log(`║   ${line}`);
        });
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        return Promise.resolve({
          sid: 'MOCK_MESSAGE_SID',
          status: 'sent',
          to: opts.to,
          from: opts.from,
          body: opts.body,
          dateCreated: new Date(),
          dateUpdated: new Date(),
          dateSent: new Date(),
          accountSid: 'MOCK_ACCOUNT_SID',
          messagingServiceSid: null,
          uri: '/mock/message',
        } as never);
      },
    },
  };
};

export default createMockTwilioClient;
