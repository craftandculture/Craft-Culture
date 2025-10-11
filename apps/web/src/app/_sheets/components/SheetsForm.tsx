'use client';

import { IconUpload } from '@tabler/icons-react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';

import extractGoogleSheetId from '@/app/_pricingModels/utils/extractGoogleSheetId';
import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogBody from '@/app/_ui/components/AlertDialog/AlertDialogBody';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldContent from '@/app/_ui/components/FormField/FormFieldContent';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import FormFieldLabel from '@/app/_ui/components/FormField/FormFieldLabel';
import Input from '@/app/_ui/components/Input/Input';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import useTRPC from '@/lib/trpc/browser';

import uploadSheetSchema, {
  UploadSheetSchema,
} from '../schemas/uploadSheetSchema';

const SheetsForm = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [existingSheetName, setExistingSheetName] = useState<string>('');
  const [pendingValues, setPendingValues] = useState<UploadSheetSchema | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useZodForm(uploadSheetSchema, {
    defaultValues: {},
  });

  const { data: sheets } = useSuspenseQuery(api.sheets.getMany.queryOptions());

  const { mutateAsync: uploadSheet } = useMutation(
    api.sheets.create.mutationOptions({
      onSuccess: () => {
        toast.success('Sheet saved successfully');
        reset();
        setPendingValues(null);

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
    const googleSheetId = extractGoogleSheetId(values.googleSheetUrl);

    if (!googleSheetId) {
      toast.error('Invalid Google Sheets URL');
      return;
    }

    const existingSheet = sheets.find((s) => s.googleSheetId === googleSheetId);

    if (existingSheet) {
      setExistingSheetName(existingSheet.name);
      setPendingValues(values);
      setShowConfirmDialog(true);
    } else {
      await uploadSheet(values);
    }
  };

  const handleConfirmUpdate = async () => {
    if (pendingValues) {
      await uploadSheet(pendingValues);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit(submitHandler)}>
        <FormField>
          <FormFieldLabel asChild>
            <label htmlFor="name">Sheet Name (Optional)</label>
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

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sheet Already Exists</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>
              The sheet &quot;{existingSheetName}&quot; already exists. Do you
              want to update it with the latest data from Google Sheets?
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost">
                <ButtonContent>Cancel</ButtonContent>
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate} asChild>
              <Button colorRole="brand">
                <ButtonContent>Continue</ButtonContent>
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SheetsForm;
