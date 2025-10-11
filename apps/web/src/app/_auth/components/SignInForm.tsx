'use client';

import { IconArrowRight } from '@tabler/icons-react';
import posthog from 'posthog-js';
import { useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import getNextPath from '@/app/_shared-platform/utils/getNextPath';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/legacy/FormField';
import Input from '@/app/_ui/components/Input/Input';
import Link from '@/app/_ui/components/Link/Link';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';

import signInSchema, { SignInSchema } from '../schemas/signInSchema';

const SignInForm = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useZodForm(signInSchema);

  const submitHandler: SubmitHandler<SignInSchema> = async (values) => {
    const { error, data: session } = await authBrowserClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: true,
      callbackURL: getNextPath() ?? '/dashboard',
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    posthog.identify(session.user.id, {
      email: session.user.email,
      name: session.user.name,
    });

    setIsLoggedIn(true);
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(submitHandler)}
    >
      <FormField
        label="E-mailadres"
        id="email"
        errorMessage={errors.email?.message}
        {...register('email')}
      >
        <Input
          id="email"
          tabIndex={1}
          size="lg"
          type="email"
          placeholder="janneke@voorbeeld.nl"
          autoFocus
          autoComplete="email"
          name="email"
        />
      </FormField>
      <FormField
        id="password"
        label="Wachtwoord"
        contentRight={
          <Link
            preserveSearch
            href="/forgot-password"
            variant="labelSm"
            colorRole="brand"
          >
            Wachtwoord vergeten?
          </Link>
        }
        errorMessage={errors.password?.message}
        {...register('password')}
      >
        <Input
          id="password"
          tabIndex={2}
          size="lg"
          type="password"
          placeholder="••••••••••"
          autoComplete="current-password"
          name="password"
        />
      </FormField>
      <Button
        type="submit"
        size="lg"
        colorRole="brand"
        isDisabled={isSubmitting || isLoggedIn}
      >
        <ButtonContent
          iconRight={IconArrowRight}
          isLoading={isSubmitting || isLoggedIn}
        >
          Inloggen
        </ButtonContent>
      </Button>
    </form>
  );
};

export default SignInForm;
