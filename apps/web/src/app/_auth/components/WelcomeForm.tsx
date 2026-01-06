'use client';

import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldContent from '@/app/_ui/components/FormField/FormFieldContent';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import FormFieldLabel from '@/app/_ui/components/FormField/FormFieldLabel';
import Input from '@/app/_ui/components/Input/Input';
import MotionDiv from '@/app/_ui/components/Motion/MotionDiv';
import Typography from '@/app/_ui/components/Typography/Typography';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import useTRPC from '@/lib/trpc/browser';

import customerTypeOptions from '../constants/customerTypeOptions';
import type { CustomerTypeValue } from '../constants/customerTypeOptions';
import { UpdateUserSchema } from '../schemas/updateUserSchema';
import updateUserSchema from '../schemas/updateUserSchema';

const WelcomeForm = () => {
  const router = useRouter();
  const [isRouting, setIsRouting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useZodForm(updateUserSchema, {
    defaultValues: {
      name: undefined,
      customerType: undefined,
    },
  });

  const selectedType = watch('customerType');

  const trpc = useTRPC();

  const { mutateAsync: updateUser } = useMutation(
    trpc.users.update.mutationOptions({
      onSuccess: () => {
        setIsRouting(true);
        router.push('/platform');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const submitHandler: SubmitHandler<UpdateUserSchema> = async (values) => {
    if (!termsAccepted) {
      toast.error('Please accept the Terms of Use to continue');
      return;
    }
    if (!values.customerType) {
      toast.error('Please select your role');
      return;
    }
    await updateUser({ ...values, acceptTerms: true });
  };

  return (
    <AnimatePresence mode="wait">
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
        <div className="w-full text-center">
          <Typography variant="headingMd" className="mb-1">
            Welcome to Craft & Culture
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Complete your profile to get started
          </Typography>
        </div>

        <form
          className="flex w-full flex-col gap-5"
          onSubmit={handleSubmit(submitHandler)}
        >
          {/* Name Field */}
          <FormField>
            <FormFieldLabel asChild>
              <label htmlFor="name">Your name</label>
            </FormFieldLabel>
            <FormFieldContent>
              <Input
                id="name"
                tabIndex={1}
                size="lg"
                type="text"
                placeholder="Enter your full name"
                autoFocus
                autoComplete="name"
                isDisabled={isSubmitting || isRouting}
                {...register('name')}
              />
              {errors.name && (
                <FormFieldError>{errors.name.message}</FormFieldError>
              )}
            </FormFieldContent>
          </FormField>

          {/* Role Selection */}
          <FormField>
            <FormFieldLabel asChild>
              <label>Select your role</label>
            </FormFieldLabel>
            <FormFieldContent>
              <Controller
                control={control}
                name="customerType"
                render={({ field }) => (
                  <div className="flex flex-col gap-2">
                    {customerTypeOptions.map((option) => {
                      const isSelected = field.value === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => field.onChange(option.value as CustomerTypeValue)}
                          disabled={isSubmitting || isRouting}
                          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                            isSelected
                              ? 'border-fill-brand bg-fill-brand/5'
                              : 'border-border-secondary hover:border-border-primary hover:bg-fill-secondary/50'
                          } ${isSubmitting || isRouting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              isSelected
                                ? 'border-fill-brand bg-fill-brand'
                                : 'border-border-muted'
                            }`}
                          >
                            {isSelected && (
                              <IconCheck size={12} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <Typography
                              variant="labelMd"
                              className={isSelected ? 'text-text-brand' : ''}
                            >
                              {option.label}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {option.description}
                            </Typography>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              {errors.customerType && (
                <FormFieldError>{errors.customerType.message}</FormFieldError>
              )}
            </FormFieldContent>
          </FormField>

          {/* Terms Acceptance */}
          <div className="rounded-lg border border-border-secondary bg-fill-secondary/30 p-4">
            <Typography variant="labelSm" className="mb-3">
              Terms of Use
            </Typography>
            <div className="mb-3 space-y-2 text-xs text-text-muted">
              <p>By continuing, you acknowledge that:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>This platform is a pricing and quotation tool only</li>
                <li>All payments are processed through licensed distribution partners</li>
                <li>You are at least 21 years of age</li>
                <li>Access is restricted to approved business users</li>
              </ul>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="termsAccepted"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                disabled={isSubmitting || isRouting}
              />
              <label
                htmlFor="termsAccepted"
                className="cursor-pointer text-xs leading-relaxed text-text-secondary"
              >
                I agree to the{' '}
                <a
                  href="/platform/terms-of-use"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-brand underline"
                >
                  Terms of Use
                </a>
              </label>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            colorRole="brand"
            isDisabled={!selectedType || !termsAccepted || isSubmitting || isRouting}
          >
            <ButtonContent
              iconRight={IconArrowRight}
              isLoading={isSubmitting || isRouting}
            >
              Continue
            </ButtonContent>
          </Button>
        </form>
      </MotionDiv>
    </AnimatePresence>
  );
};

export default WelcomeForm;
