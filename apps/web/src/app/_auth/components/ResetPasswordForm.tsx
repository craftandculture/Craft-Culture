'use client';

import { IconArrowRight, IconCircleCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/legacy/FormField';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';

import resetPasswordSchema, {
  ResetPasswordSchema,
} from '../schemas/resetPasswordSchema';

const ResetPasswordForm = () => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isSubmitSuccessful, errors },
  } = useZodForm(resetPasswordSchema);

  const submitHandler: SubmitHandler<ResetPasswordSchema> = async ({
    email,
  }) => {
    const { error } = await authBrowserClient.requestPasswordReset({
      email,
      redirectTo: '/update-password?next=/dashboard',
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success('E-mail verstuurd');
  };

  if (isSubmitSuccessful) {
    return (
      <>
        <Icon
          icon={IconCircleCheck}
          size="xl"
          colorRole="success"
          className="self-center"
        />
        <Typography variant="headingMd" className="w-full text-center">
          E-mail verstuurd
        </Typography>
        <Typography variant="bodySm" className="text-center">
          Gelukt! We hebben je een e-mail gestuurd met een link om je wachtwoord
          opnieuw in te stellen.
        </Typography>
        <Button size="lg" colorRole="brand" asChild>
          <Link href="/sign-in">
            <ButtonContent>Terug naar inloggen</ButtonContent>
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Typography variant="headingMd" className="w-full text-center">
        Herstel wachtwoord
      </Typography>
      <Typography variant="bodySm" className="text-center">
        Vul je e-mailadres in om een link te ontvangen waarmee je je wachtwoord
        opnieuw kunt instellen.
      </Typography>
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(submitHandler)}
      >
        <FormField
          label="E-mailadres"
          id="email"
          errorMessage={errors.email?.message}
        >
          <Input
            tabIndex={1}
            size="lg"
            type="email"
            placeholder="janneke@voorbeeld.nl"
            autoFocus
            autoComplete="email"
            {...register('email')}
          />
        </FormField>
        <Button
          type="submit"
          size="lg"
          colorRole="brand"
          isDisabled={isSubmitting}
        >
          <ButtonContent iconRight={IconArrowRight} isLoading={isSubmitting}>
            Verstuur link
          </ButtonContent>
        </Button>
      </form>
    </>
  );
};

export default ResetPasswordForm;
