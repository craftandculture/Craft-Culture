'use client';

import getNextPath from '@/app/_shared-platform/utils/getNextPath';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import IconGoogle from '@/app/_ui/components/Icon/IconGoogle';
import authBrowserClient from '@/lib/better-auth/browser';

const GoogleButton = () => {
  return (
    <Button
      size="lg"
      colorRole="primary"
      onClick={() => {
        void authBrowserClient.signIn.social({
          provider: 'google',
          requestSignUp: true,
          callbackURL: getNextPath() ?? '/dashboard',
          newUserCallbackURL: getNextPath() ?? '/onboarding',
        });
      }}
    >
      <ButtonContent iconLeft={IconGoogle} align="center">
        Google
      </ButtonContent>
    </Button>
  );
};

export default GoogleButton;
