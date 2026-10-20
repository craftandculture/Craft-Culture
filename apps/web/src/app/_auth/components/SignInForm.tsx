'use client';

import { IconArrowRight, IconFingerprint, IconMail, IconRefresh } from '@tabler/icons-react';
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
import FormFieldLabel from '@/app/_ui/components/FormField/FormFieldLabel';
import Input from '@/app/_ui/components/Input/Input';
import MotionDiv from '@/app/_ui/components/Motion/MotionDiv';
import Typography from '@/app/_ui/components/Typography/Typography';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';
import features from '@/lib/features';

import type { SignInSchema } from '../schemas/signInSchema';
import signInSchema from '../schemas/signInSchema';

/** How long the emailed link works; matches `magicLink({ expiresIn })` on the server */
const LINK_MINUTES = 30;

/** Seconds before another link can be requested */
const RESEND_AFTER = 30;

const HELP_EMAIL = 'enquiries@craftculture.xyz';

const transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

const sendLink = (email: string) =>
  authBrowserClient.signIn.magicLink({
    email,
    callbackURL: getNextPath() ?? '/platform',
    newUserCallbackURL: '/welcome',
  });

/**
 * Sign in by emailed link, or by passkey on devices that have one
 *
 * Email comes first because it is how nearly everyone signs in; a passkey is
 * offered beneath it only where the device supports one. Once a link is sent,
 * the screen says where it went, how long it lasts, and what to do when it has
 * not arrived, including the company link-scanner case, which is where people
 * most often get stuck.
 */
const SignInForm = () => {
  const [supportsPasskey, setSupportsPasskey] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const {
    watch,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isSubmitSuccessful },
  } = useZodForm(signInSchema);

  useEffect(() => {
    const checkPasskeySupport = async () => {
      if (features.passkeys && typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setSupportsPasskey(available);
        } catch {
          setSupportsPasskey(false);
        }
      }
    };
    void checkPasskeySupport();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handlePasskeySignIn = async () => {
    setIsPasskeyLoading(true);
    try {
      const { error } = await authBrowserClient.signIn.passkey();

      if (error) {
        toast.error(error.message || 'Your passkey could not be used. Try the email link instead.');
        return;
      }

      window.location.href = getNextPath() ?? '/platform';
    } catch {
      toast.error('Your passkey could not be used. Try the email link instead.');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const submitHandler: SubmitHandler<SignInSchema> = async (values) => {
    const { error } = await sendLink(values.email);

    if (error) {
      toast.error(error.message);
      throw error;
    }

    setResendIn(RESEND_AFTER);
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await sendLink(watch('email'));
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('A new sign-in link is on its way');
      setResendIn(RESEND_AFTER);
    } finally {
      setIsResending(false);
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
          transition={transition}
          className="flex w-full flex-col gap-6"
        >
          <span className="bg-surface-muted grid size-12 place-items-center rounded-xl">
            <IconMail size={22} className="text-text-primary" />
          </span>

          <div className="flex flex-col gap-1.5">
            <Typography variant="headingMd">Check your inbox</Typography>
            <Typography variant="bodySm" colorRole="muted">
              We sent a sign-in link to <span className="text-text-primary font-semibold">{watch('email')}</span>. It
              works once and expires in {LINK_MINUTES} minutes.
            </Typography>
          </div>

          <div className="bg-surface-muted flex flex-col gap-2 rounded-xl px-4 py-3.5">
            <Typography variant="bodySm">
              <span className="font-semibold">Not there yet?</span> It can take a minute. Check your junk or spam folder.
            </Typography>
            <Typography variant="bodySm">
              <span className="font-semibold">Using a work email?</span> If your company scans links, open the email,
              then press <span className="font-semibold">Sign in</span> on the page that opens.
            </Typography>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full"
              onClick={handleResend}
              isDisabled={isResending || resendIn > 0}
            >
              <ButtonContent iconLeft={IconRefresh} isLoading={isResending}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend link'}
              </ButtonContent>
            </Button>
            <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => reset()}>
              <ButtonContent>Use a different email</ButtonContent>
            </Button>
          </div>
        </MotionDiv>
      ) : (
        <MotionDiv
          key="form"
          initial={false}
          exit={{ opacity: 0, y: -10 }}
          transition={transition}
          className="flex w-full flex-col gap-6"
        >
          <div className="flex flex-col gap-1.5">
            <Typography variant="headingMd">Sign in</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Enter your email and we will send you a secure sign-in link. There is no password to remember.
            </Typography>
          </div>

          <form className="flex w-full flex-col gap-4" onSubmit={handleSubmit(submitHandler)}>
            <FormField>
              <FormFieldLabel asChild>
                <label htmlFor="email">Email address</label>
              </FormFieldLabel>
              <FormFieldContent>
                <Input
                  id="email"
                  tabIndex={1}
                  size="lg"
                  type="email"
                  placeholder="name@company.com"
                  autoFocus
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && <FormFieldError>{errors.email.message}</FormFieldError>}
              </FormFieldContent>
            </FormField>
            <Button
              type="submit"
              size="lg"
              colorRole="bold"
              className="border-text-primary bg-text-primary text-surface-primary hover:bg-text-primary/90"
              isDisabled={isSubmitting}
            >
              <ButtonContent iconRight={IconArrowRight} isLoading={isSubmitting}>
                Email me a sign-in link
              </ButtonContent>
            </Button>
          </form>

          {supportsPasskey && (
            <>
              <div className="flex w-full items-center gap-4">
                <Divider />
                <Typography variant="bodyXs" colorRole="muted" className="shrink-0">
                  or
                </Typography>
                <Divider />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={handlePasskeySignIn}
                  isDisabled={isPasskeyLoading}
                >
                  <ButtonContent iconLeft={IconFingerprint} isLoading={isPasskeyLoading}>
                    Sign in with a passkey
                  </ButtonContent>
                </Button>
                <Typography variant="bodyXs" colorRole="muted">
                  A passkey uses Face ID, Touch ID or your device PIN.
                </Typography>
              </div>
            </>
          )}

          <div className="border-border-muted border-t pt-4">
            <Typography variant="bodyXs" colorRole="muted">
              <span className="text-text-primary font-medium">Trouble signing in?</span> Email{' '}
              <span className="select-all">{HELP_EMAIL}</span>
            </Typography>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

export default SignInForm;
