'use client';

import { IconArrowRight, IconCircleCheck } from '@tabler/icons-react';
import NextLink from 'next/link';
import { useMemo } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import getNextPath from '@/app/_shared-platform/utils/getNextPath';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import FormField from '@/app/_ui/components/FormField/legacy/FormField';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Link from '@/app/_ui/components/Link/Link';
import Typography from '@/app/_ui/components/Typography/Typography';
import useSearchParams from '@/app/_ui/hooks/useSearchParams';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';

import GoogleButton from './GoogleButton';
import StrengthIndicator from './StrengthIndicator';
import signUpSchema, { SignUpSchema } from '../schemas/signUpSchema';
import getPasswordStrength from '../uitls/passwordStrength';

const SignUpForm = () => {
  const search = useSearchParams();

  const email = search.get('email');
  const isSuccess = search.get('success');

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, isSubmitSuccessful, errors },
  } = useZodForm(signUpSchema, {
    defaultValues: { email: email ?? undefined },
  });

  const password = watch('password');

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const submitHandler: SubmitHandler<SignUpSchema> = async ({
    name,
    email,
    password,
  }) => {
    const { error } = await authBrowserClient.signUp.email({
      email,
      password,
      name,
      callbackURL: getNextPath() ?? '/onboarding',
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success('Account aangemaakt');
  };

  if (isSubmitSuccessful || isSuccess) {
    return (
      <>
        <Icon
          icon={IconCircleCheck}
          size="xl"
          colorRole="success"
          className="self-center"
        />
        <Typography variant="headingMd" className="w-full text-center">
          Bevestig je e-mailadres
        </Typography>
        <Typography variant="bodySm" className="text-center">
          Gelukt! We hebben je een e-mail gestuurd met een link om je account te
          bevestigen. Klik op de link in de e-mail om verder te gaan.
        </Typography>
        <Button size="lg" colorRole="brand" asChild>
          <NextLink href="/sign-in">
            <ButtonContent>Terug naar inloggen</ButtonContent>
          </NextLink>
        </Button>
      </>
    );
  }

  return (
    <>
      <Typography variant="headingMd" className="w-full text-center">
        Aan de slag
      </Typography>
      <Typography variant="bodySm" colorRole="muted" className="text-center">
        Ga verder met
      </Typography>
      <GoogleButton />
      <Divider borderStyle="dashed" />
      <Typography variant="bodySm" colorRole="muted" className="text-center">
        Of gebruik een e-mail en wachtwoord
      </Typography>
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(submitHandler)}
      >
        <FormField label="Naam" id="name" errorMessage={errors.name?.message}>
          <Input
            id="name"
            tabIndex={1}
            size="lg"
            type="text"
            placeholder="Janneke van der Veen"
            autoFocus
            autoComplete="name"
            {...register('name')}
          />
        </FormField>
        <FormField
          label="E-mailadres"
          id="email"
          errorMessage={errors.email?.message}
        >
          <Input
            id="email"
            tabIndex={1}
            size="lg"
            type="email"
            placeholder="janneke@voorbeeld.nl"
            autoFocus
            autoComplete="email"
            {...register('email')}
          />
        </FormField>
        <FormField
          label="Wachtwoord"
          id="password"
          contentRight={<StrengthIndicator strength={strength} />}
          errorMessage={errors.password?.message}
        >
          <Input
            id="password"
            tabIndex={2}
            size="lg"
            type="password"
            placeholder="••••••••••"
            autoComplete="new-password"
            {...register('password')}
          />
        </FormField>
        <Button
          type="submit"
          size="lg"
          colorRole="brand"
          isDisabled={isSubmitting}
        >
          <ButtonContent iconRight={IconArrowRight} isLoading={isSubmitting}>
            Ga verder
          </ButtonContent>
        </Button>
      </form>
      <Typography
        variant="bodySm"
        colorRole="muted"
        className="flex items-center justify-center gap-1.5 text-center"
      >
        Heb je al een account?{' '}
        <Link
          colorRole="brand"
          href="/sign-in"
          variant="labelSm"
          preserveSearch
        >
          Inloggen
        </Link>
      </Typography>
    </>
  );
};

export default SignUpForm;
