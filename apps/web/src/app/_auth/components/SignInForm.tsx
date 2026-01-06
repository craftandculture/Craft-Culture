'use client';

import { IconArrowLeft, IconArrowRight, IconFingerprint } from '@tabler/icons-react';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import getNextPath from '@/app/_shared/utils/getNextPath';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldContent from '@/app/_ui/components/FormField/FormFieldContent';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import Input from '@/app/_ui/components/Input/Input';
import MotionDiv from '@/app/_ui/components/Motion/MotionDiv';
import Typography from '@/app/_ui/components/Typography/Typography';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';
import features from '@/lib/features';

import type { SignInSchema } from '../schemas/signInSchema';
import signInSchema from '../schemas/signInSchema';

const SignInWithUsernamePasswordForm = () => {
  const [supportsPasskey, setSupportsPasskey] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const {
    watch,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isSubmitSuccessful },
  } = useZodForm(signInSchema);

  // Check if browser supports WebAuthn
  useEffect(() => {
    const checkPasskeySupport = async () => {
      if (
        features.passkeys &&
        typeof window !== 'undefined' &&
        window.PublicKeyCredential
      ) {
        try {
          const available =
            await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setSupportsPasskey(available);
        } catch {
          setSupportsPasskey(false);
        }
      }
    };
    void checkPasskeySupport();
  }, []);

  const handlePasskeySignIn = async () => {
    setIsPasskeyLoading(true);
    try {
      const { error } = await authBrowserClient.signIn.passkey();

      if (error) {
        toast.error(error.message || 'Failed to sign in with passkey');
        return;
      }

      // Redirect on success
      window.location.href = getNextPath() ?? '/platform';
    } catch {
      toast.error('Passkey authentication failed. Please try again.');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const submitHandler: SubmitHandler<SignInSchema> = async (values) => {
    const { error } = await authBrowserClient.signIn.magicLink({
      email: values.email,
      callbackURL: getNextPath() ?? '/platform',
      newUserCallbackURL: '/welcome',
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isSubmitSuccessful ? (
        <MotionDiv
          key="success"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="flex w-full flex-col items-center gap-6"
        >
          <Typography variant="headingMd" className="w-full text-center">
            Check your email
          </Typography>
          <Typography variant="bodySm" className="text-text-muted text-center">
            We&apos;ve sent you a temporary login link.
            <br />
            Please check your inbox at{' '}
            <span className="text-text-primary font-bold">
              {watch('email')}
            </span>
            .
          </Typography>
          <Button size="md" variant="ghost" onClick={() => reset()}>
            <ButtonContent iconLeft={IconArrowLeft}>
              Back to sign in
            </ButtonContent>
          </Button>
        </MotionDiv>
      ) : (
        <MotionDiv
          key="form"
          initial={false}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="flex w-full flex-col items-center gap-6"
        >
          <Typography variant="headingMd" className="w-full text-center">
            Sign in to your account
          </Typography>

          {/* Passkey Sign In */}
          {supportsPasskey && (
            <>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handlePasskeySignIn}
                isDisabled={isPasskeyLoading}
              >
                <ButtonContent
                  iconLeft={IconFingerprint}
                  isLoading={isPasskeyLoading}
                >
                  Sign in with passkey
                </ButtonContent>
              </Button>
              <div className="flex w-full items-center gap-4">
                <Divider />
                <Typography variant="bodyXs" colorRole="muted" className="shrink-0">
                  or use email
                </Typography>
                <Divider />
              </div>
            </>
          )}

          <form
            className="flex w-full flex-col gap-4"
            onSubmit={handleSubmit(submitHandler)}
          >
            <FormField>
              <FormFieldContent>
                <Input
                  id="email"
                  tabIndex={1}
                  size="lg"
                  type="email"
                  placeholder="Enter your email address"
                  autoFocus={!supportsPasskey}
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <FormFieldError>{errors.email.message}</FormFieldError>
                )}
              </FormFieldContent>
            </FormField>
            <Button
              type="submit"
              size="lg"
              colorRole="brand"
              isDisabled={isSubmitting}
            >
              <ButtonContent
                iconRight={IconArrowRight}
                isLoading={isSubmitting}
              >
                Continue with email
              </ButtonContent>
            </Button>
          </form>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

export default SignInWithUsernamePasswordForm;
