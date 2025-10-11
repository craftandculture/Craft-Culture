'use client';

import { IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldContent from '@/app/_ui/components/FormField/FormFieldContent';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import FormFieldLabel from '@/app/_ui/components/FormField/FormFieldLabel';
import Input from '@/app/_ui/components/Input/Input';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import useTRPC from '@/lib/trpc/browser';

import uploadSheetSchema, { UploadSheetSchema } from '../schemas/uploadSheetSchema';

const SheetsForm = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useZodForm(uploadSheetSchema, {
    defaultValues: {},
  });

  const { mutateAsync: uploadSheet } = useMutation(
    api.sheets.create.mutationOptions({
      onSuccess: () => {
        toast.success('Sheet saved successfully');
        reset();

        void queryClient.invalidateQueries({
          queryKey: [['sheets', 'getMany']],
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const submitHandler: SubmitHandler<UploadSheetSchema> = async (values) => {
    await uploadSheet(values);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submitHandler)}>
      <FormField>
        <FormFieldLabel asChild>
          <label htmlFor="name">Sheet Name</label>
        </FormFieldLabel>
        <FormFieldContent>
          <Input
            id="name"
            type="text"
            placeholder="e.g. 2024 Q4 Pricing"
            isDisabled={isSubmitting}
            {...register('name')}
          />
          {errors.name && (
            <FormFieldError>{errors.name.message}</FormFieldError>
          )}
        </FormFieldContent>
      </FormField>
      <FormField>
        <FormFieldLabel asChild>
          <label htmlFor="googleSheetUrl">Google Sheets URL</label>
        </FormFieldLabel>
        <FormFieldContent>
          <Input
            id="googleSheetUrl"
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            isDisabled={isSubmitting}
            {...register('googleSheetUrl')}
          />
          {errors.googleSheetUrl && (
            <FormFieldError>{errors.googleSheetUrl.message}</FormFieldError>
          )}
        </FormFieldContent>
      </FormField>
      <Button type="submit" colorRole="brand" isDisabled={isSubmitting}>
        <ButtonContent iconLeft={IconUpload} isLoading={isSubmitting}>
          Upload Sheet
        </ButtonContent>
      </Button>
    </form>
  );
};

export default SheetsForm;
