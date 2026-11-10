import { toast } from 'sonner';

export const MEMBER_ERROR_MESSAGE =
  'We could not complete that request. Please try again, or contact your account manager.';

/**
 * Tells a member that something did not go through, in one fixed
 * professional sentence. The server's own message is written for the team
 * (codes, field names, stack wording) and is kept to the console instead.
 *
 * @param error - The error returned by the failed request
 */
const memberErrorToast = (error: unknown) => {
  console.error(error);
  toast.error(MEMBER_ERROR_MESSAGE);
};

export default memberErrorToast;
