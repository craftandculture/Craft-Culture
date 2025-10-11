'use client';

import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { AnimatePresence } from 'motion/react';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import getNextPath from '@/app/_shared/utils/getNextPath';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldContent from '@/app/_ui/components/FormField/FormFieldContent';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import Input from '@/app/_ui/components/Input/Input';
import MotionDiv from '@/app/_ui/components/Motion/MotionDiv';
import Typography from '@/app/_ui/components/Typography/Typography';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';

import signInSchema, { SignInSchema } from '../schemas/signInSchema';

const SignInWithUsernamePasswordForm = () => {
  const {
    watch,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isSubmitSuccessful },
  } = useZodForm(signInSchema);

  const submitHandler: SubmitHandler<SignInSchema> = async (values) => {
    const { error } = await authBrowserClient.signIn.magicLink({
      email: values.email,
      callbackURL: getNextPath() ?? '/platform',
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
            What&apos;s your email address?
          </Typography>
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
                  autoFocus
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
