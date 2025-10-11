'use client';

import { SelectTrigger } from '@radix-ui/react-select';
import { IconArrowRight } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldContent from '@/app/_ui/components/FormField/FormFieldContent';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import FormFieldLabel from '@/app/_ui/components/FormField/FormFieldLabel';
import Input from '@/app/_ui/components/Input/Input';
import MotionDiv from '@/app/_ui/components/Motion/MotionDiv';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectItemContent from '@/app/_ui/components/Select/SelectItemContent';
import SelectTriggerContent from '@/app/_ui/components/Select/SelectTriggerContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import useTRPC from '@/lib/trpc/browser';

import { UpdateUserSchema } from '../schemas/updateUserSchema';
import updateUserSchema from '../schemas/updateUserSchema';

const WelcomeForm = () => {
  const router = useRouter();
  const [isRouting, setIsRouting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useZodForm(updateUserSchema, {
    defaultValues: {
      name: undefined,
      customerType: 'b2c',
    },
  });

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
    await updateUser(values);
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
        <Typography variant="headingMd" className="w-full text-center">
          Welcome to Craft & Culture
        </Typography>
        <form
          className="flex w-full flex-col gap-4"
          onSubmit={handleSubmit(submitHandler)}
        >
          <FormField>
            <FormFieldLabel asChild>
              <label htmlFor="name">Name</label>
            </FormFieldLabel>
            <FormFieldContent>
              <Input
                id="name"
                tabIndex={1}
                size="lg"
                type="text"
                placeholder="Enter your name"
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
          <FormField>
            <FormFieldLabel asChild>
              <label htmlFor="customerType">Customer type</label>
            </FormFieldLabel>
            <FormFieldContent>
              <Controller
                control={control}
                name="customerType"
                defaultValue="b2c"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} {...field}>
                    <SelectTrigger asChild className="max-w-xl">
                      <Button isDisabled={isSubmitting || isRouting}>
                        <SelectTriggerContent />
                      </Button>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="b2c">
                        <SelectItemContent>Sales Person</SelectItemContent>
                      </SelectItem>
                      <SelectItem value="b2b">
                        <SelectItemContent>Distributor</SelectItemContent>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.customerType && (
                <FormFieldError>{errors.customerType.message}</FormFieldError>
              )}
            </FormFieldContent>
          </FormField>
          <Button
            type="submit"
            size="lg"
            colorRole="brand"
            isDisabled={isSubmitting || isRouting}
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
