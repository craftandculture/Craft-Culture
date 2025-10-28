import twilio from 'twilio';

import serverConfig from '@/server.config';

const twilioClient =
  serverConfig.twilioAccountSid && serverConfig.twilioAuthToken
    ? twilio(serverConfig.twilioAccountSid, serverConfig.twilioAuthToken)
    : null;

export default twilioClient;
