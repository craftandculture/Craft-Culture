/**
 * Loops transactional template ids for Private Cellar onboarding
 *
 * Each email is a custom template built in Loops (templates can only be made
 * in Loops' own editor). Until an id is filled in here, that email is skipped
 * and logged — sign-ups work fully without any of them.
 *
 * Data variables each template receives are listed beside it.
 */
const loopsTemplates = {
  /** name, inviterName, joinUrl, expiresOn */
  invite: '',
  /** name, statusUrl */
  applicationReceived: '',
  /** applicantName, applicantEmail, phone, missing, wineSources, adminUrl */
  newApplicationAdmin: '',
  /** name, cellarUrl */
  cellarReady: '',
  /** name, reason */
  applicationDeclined: '',
  /** name, source, holderName, stage, cellarUrl */
  transferUpdate: '',
  /** name, missing, cellarUrl */
  finishSettingUp: '',
  /** name, holderName, accessLevel, acceptUrl, expiresOn */
  cellarAccessInvite: '',
} as const;

export type OnboardingEmail = keyof typeof loopsTemplates;

export default loopsTemplates;
