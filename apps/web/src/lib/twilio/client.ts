import twilio from 'twilio';

import serverConfig from '@/server.config';

import createMockTwilioClient from './mockClient';

/**
 * Twilio SMS client
 *
 * In development mode, uses a mock client that logs SMS to console
 * In production/preview, uses the real Twilio API (if credentials are configured)
 */
const twilioClient =
  serverConfig.env === 'development'
    ? createMockTwilioClient()
    : serverConfig.twilioAccountSid && serverConfig.twilioAuthToken
      ? twilio(serverConfig.twilioAccountSid, serverConfig.twilioAuthToken)
      : null;

export default twilioClient;
