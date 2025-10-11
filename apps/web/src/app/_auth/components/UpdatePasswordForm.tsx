'use client';

import { IconArrowRight, IconCircleCheck } from '@tabler/icons-react';
import NextLink from 'next/link';
import { useMemo } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/legacy/FormField';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useSearchParams from '@/app/_ui/hooks/useSearchParams';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import authBrowserClient from '@/lib/better-auth/browser';

import StrengthIndicator from './StrengthIndicator';
import updatePasswordSchema, {
  UpdatePasswordSchema,
} from '../schemas/updatePasswordSchema';
import getPasswordStrength from '../uitls/passwordStrength';

const UpdatePasswordForm = () => {
  const search = useSearchParams();

  const isSuccess = search.get('success');
  const token = search.get('token');

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, isSubmitSuccessful, errors },
  } = useZodForm(updatePasswordSchema);

  const password = watch('password');

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const submitHandler: SubmitHandler<UpdatePasswordSchema> = async ({
    password,
  }) => {
    const { error } = await authBrowserClient.resetPassword({
      newPassword: password,
      token: token ?? '',
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success('Wachtwoord gewijzigd');
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
          Wachtwoord gewijzigd
        </Typography>
        <Typography variant="bodySm" className="text-center">
          Gelukt! Je wachtwoord is gewijzigd.
        </Typography>
        <Button size="lg" colorRole="brand" asChild>
          <NextLink href="/dashboard">
            <ButtonContent iconRight={IconArrowRight}>Ga verder</ButtonContent>
          </NextLink>
        </Button>
      </>
    );
  }

  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(submitHandler)}
      >
        <FormField
          label="Nieuw wachtwoord"
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
        <FormField
          label="Bevestig nieuw wachtwoord"
          id="confirmPassword"
          errorMessage={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            tabIndex={3}
            size="lg"
            type="password"
            {...register('confirmPassword')}
          />
        </FormField>
        <Button
          type="submit"
          size="lg"
          colorRole="brand"
          isDisabled={isSubmitting}
        >
          <ButtonContent iconRight={IconArrowRight} isLoading={isSubmitting}>
            Wijzig wachtwoord
          </ButtonContent>
        </Button>
      </form>
    </>
  );
};

export default UpdatePasswordForm;
