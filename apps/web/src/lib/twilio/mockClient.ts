import type { Twilio } from 'twilio';

import logger from '@/utils/logger';

/**
 * Mock Twilio client for development/testing
 *
 * Logs SMS details to console instead of sending actual messages
 * Useful for local development and testing SMS flows
 */
const createMockTwilioClient = (): Twilio => {
  return {
    messages: {
      create: async (options) => {
        logger.dev('📱 [MOCK SMS] Would send SMS:', {
          to: options.to,
          from: options.from,
          body: options.body,
        });

        // Log in a user-friendly format
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                      📱 MOCK SMS SENT                          ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        console.log(`║ From: ${options.from}`);
        console.log(`║ To: ${options.to}`);
        console.log('║ Body:');
        const bodyLines = options.body?.toString().split('\n') || [];
        bodyLines.forEach((line) => {
          console.log(`║   ${line}`);
        });
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        return Promise.resolve({
          sid: 'MOCK_MESSAGE_SID',
          status: 'sent',
          to: options.to as string,
          from: options.from as string,
          body: options.body as string,
          dateCreated: new Date(),
          dateUpdated: new Date(),
          dateSent: new Date(),
          accountSid: 'MOCK_ACCOUNT_SID',
          messagingServiceSid: null,
          uri: '/mock/message',
        });
      },
    },
  } as Twilio;
};

export default createMockTwilioClient;
