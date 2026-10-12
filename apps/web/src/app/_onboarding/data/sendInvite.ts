import serverConfig from '@/server.config';

import sendOnboardingEmail from '../utils/sendOnboardingEmail';

interface SendInviteParams {
  token: string;
  email: string;
  name: string;
  inviterName: string;
  expiresAt: Date;
}

/**
 * Email an invitation, and return its link
 *
 * The link is returned whether or not the email went — until the Loops
 * template exists it does not, and the admin sends the link on WhatsApp.
 *
 * @returns The join link and whether the email was sent
 */
const sendInvite = async ({ token, email, name, inviterName, expiresAt }: SendInviteParams) => {
  const joinUrl = `${serverConfig.appUrl}/join?invite=${token}`;

  const emailed = await sendOnboardingEmail('invite', email, {
    name,
    inviterName,
    joinUrl,
    expiresOn: expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
  });

  return { joinUrl, emailed };
};

export default sendInvite;
