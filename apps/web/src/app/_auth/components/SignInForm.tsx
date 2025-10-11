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
import FormFieldLabel from '@/app/_ui/components/FormField/FormFieldLabel';
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
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(submitHandler)}
      >
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
              placeholder="Email address"
              autoFocus
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <FormFieldError>{errors.email.message}</FormFieldError>
            )}
          </FormFieldContent>
        </FormField>
        <FormField>
          <FormFieldLabel asChild>
            <label htmlFor="password">Password</label>
          </FormFieldLabel>
          <FormFieldContent>
            <Input
              id="password"
              tabIndex={2}
              size="lg"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <FormFieldError>{errors.password.message}</FormFieldError>
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
            Continue
          </ButtonContent>
        </Button>
      </form>
    </>
  );
};

export default SignInWithUsernamePasswordForm;
