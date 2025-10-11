'use client';

import { IconArrowRight } from '@tabler/icons-react';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import getNextPath from '@/app/_shared/utils/getNextPath';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldContent from '@/app/_ui/components/FormField/FormFieldContent';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import Input from '@/app/_ui/components/Input/Input';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';

import signInSchema, { SignInSchema } from '../schemas/signInSchema';

const SignInWithUsernamePasswordForm = () => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
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
    <>
      <form
        className="flex w-full flex-col gap-4"
        onSubmit={handleSubmit(submitHandler)}
      >
        <FormField>
          {/* <FormFieldLabel asChild>
            <label htmlFor="email">Email address</label>
          </FormFieldLabel> */}
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
          <ButtonContent iconRight={IconArrowRight} isLoading={isSubmitting}>
            Continue with email
          </ButtonContent>
        </Button>
      </form>
    </>
  );
};

export default SignInWithUsernamePasswordForm;
