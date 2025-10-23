'use client';

import { SelectTrigger } from '@radix-ui/react-select';
import { IconPlus } from '@tabler/icons-react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useEffect } from 'react';
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
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectItemContent from '@/app/_ui/components/Select/SelectItemContent';
import SelectTriggerContent from '@/app/_ui/components/Select/SelectTriggerContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useZodForm from '@/app/_ui/hooks/useZodForm';
import useTRPC from '@/lib/trpc/browser';

import createPricingModelSchema, {
  CreatePricingModelSchema,
} from '../schemas/createPricingModelSchema';

const defaultCellMappings = {
  name: "'Example Pricing Model'!A7:A16",
  lwin18: "'Example Pricing Model'!B7:B16",
  region: "'Example Pricing Model'!C7:C16",
  producer: "'Example Pricing Model'!D7:D16",
  vintage: "'Example Pricing Model'!E7:E16",
  quantity: "'Example Pricing Model'!F7:F16",
  unitCount: "'Example Pricing Model'!G7:G16",
  unitSize: "'Example Pricing Model'!H7:H16",
  source: "'Example Pricing Model'!I7:I16",
  price: "'Example Pricing Model'!J7:J16",
  currency: "'Example Pricing Model'!K7:K16",
  exchangeRateUsd: "'Example Pricing Model'!L7:L16",
  basePriceUsd: "'Example Pricing Model'!M7:M16",
  priceUsd: "'Example Pricing Model'!R7:R16",
  customerName: "'Example Pricing Model'!B1",
  customerEmail: "'Example Pricing Model'!B2",
  customerType: "'Example Pricing Model'!B3",
  finalPriceUsd: "'Example Pricing Model'!B4",
};

type CellMappingKey = keyof CreatePricingModelSchema['cellMappings'];

type CellMappingField = {
  key: CellMappingKey;
  label: string;
  description: string;
  placeholder: string;
};

const requiredCellMappingFields: CellMappingField[] = [
  {
    key: 'priceUsd',
    label: 'Price AED *',
    description: 'Column range (required, max 10 rows)',
    placeholder: "'Example Pricing Model'!R7:R16",
  },
  {
    key: 'finalPriceUsd',
    label: 'Final Price AED *',
    description: 'Single cell (required)',
    placeholder: "'Example Pricing Model'!B4",
  },
];

const optionalCellMappingFields: CellMappingField[] = [
  {
    key: 'name',
    label: 'Name',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!A7:A16",
  },
  {
    key: 'lwin18',
    label: 'LWIN18',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!B7:B16",
  },
  {
    key: 'region',
    label: 'Region',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!C7:C16",
  },
  {
    key: 'producer',
    label: 'Producer',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!C7:C16",
  },
  {
    key: 'vintage',
    label: 'Vintage',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!D7:D16",
  },
  {
    key: 'quantity',
    label: 'Quantity',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!E7:E16",
  },
  {
    key: 'unitCount',
    label: 'Unit Count',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!F7:F16",
  },
  {
    key: 'unitSize',
    label: 'Unit Size',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!G7:G16",
  },
  {
    key: 'source',
    label: 'Source',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!H7:H16",
  },
  {
    key: 'price',
    label: 'Price',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!I7:I16",
  },
  {
    key: 'currency',
    label: 'Currency',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!J7:J16",
  },
  {
    key: 'exchangeRateUsd',
    label: 'Exchange Rate AED',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!K7:K16",
  },
  {
    key: 'basePriceUsd',
    label: 'Base Price AED',
    description: 'Column range (optional, max 10 rows)',
    placeholder: "'Example Pricing Model'!L7:L16",
  },
  {
    key: 'customerName',
    label: 'Customer Name',
    description: 'Single cell (optional)',
    placeholder: "'Example Pricing Model'!B1",
  },
  {
    key: 'customerEmail',
    label: 'Customer Email',
    description: 'Single cell (optional)',
    placeholder: "'Example Pricing Model'!B2",
  },
  {
    key: 'customerType',
    label: 'Customer Type',
    description: 'Single cell (optional)',
    placeholder: "'Example Pricing Model'!B3",
  },
];

const PricingModelsForm = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: sheets } = useSuspenseQuery(api.sheets.getMany.queryOptions());

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors, isSubmitSuccessful },
  } = useZodForm(createPricingModelSchema, {
    defaultValues: {
      modelName: 'Example Pricing Model',
      isDefaultB2C: false,
      isDefaultB2B: false,
      cellMappings: defaultCellMappings,
    },
  });

  const { mutateAsync: createPricingModel } = useMutation(
    api.pricingModels.create.mutationOptions({
      onSuccess: () => {
        toast.success('Pricing model created successfully');
        reset();

        void queryClient.invalidateQueries({
          queryKey: [['pricingModels', 'getMany']],
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const submitHandler: SubmitHandler<CreatePricingModelSchema> = async (
    values,
  ) => {
    await createPricingModel(values);
  };

  useEffect(() => {
    if (isSubmitSuccessful) {
      reset({
        modelName: 'Example Pricing Model',
        isDefaultB2C: false,
        isDefaultB2B: false,
        cellMappings: defaultCellMappings,
      });
    }
  }, [isSubmitSuccessful, reset]);

  if (sheets.length === 0) {
    return (
      <Typography variant="bodySm" className="text-text-muted">
        Please upload a sheet first before creating a pricing model.
      </Typography>
    );
  }

  const renderCellMappingFields = (fields: CellMappingField[]) => (
    <div className="border-border-primary overflow-hidden rounded-lg border">
      <div className="hidden bg-surface-muted px-4 py-3 text-sm font-medium text-text-primary sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
        <span>Field</span>
        <span>Cell Reference</span>
      </div>
      <div className="divide-y divide-border-primary">
        {fields.map((field) => {
          const registerKey = `cellMappings.${field.key}` as const;
          const fieldError = errors.cellMappings?.[field.key];

          return (
            <div
              key={field.key}
              className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start sm:gap-6"
            >
              <div>
                <Typography variant="bodySm" className="font-medium">
                  {field.label}
                </Typography>
                <Typography variant="bodySm" className="text-text-muted">
                  {field.description}
                </Typography>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Typography
                  variant="bodyXs"
                  className="text-text-muted uppercase tracking-tight sm:hidden"
                >
                  Cell Reference
                </Typography>
                <Input
                  type="text"
                  placeholder={field.placeholder}
                  isDisabled={isSubmitting}
                  {...register(registerKey)}
                />
                {fieldError && (
                  <FormFieldError>{fieldError.message}</FormFieldError>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <form className="space-y-8" onSubmit={handleSubmit(submitHandler)}>
      <div className="space-y-4">
        <FormField>
          <FormFieldLabel asChild>
            <label htmlFor="modelName">Model Name</label>
          </FormFieldLabel>
          <FormFieldContent>
            <Input
              id="modelName"
              type="text"
              placeholder="e.g. B2B Pricing Model"
              isDisabled={isSubmitting}
              {...register('modelName')}
            />
            {errors.modelName && (
              <FormFieldError>{errors.modelName.message}</FormFieldError>
            )}
          </FormFieldContent>
        </FormField>
        <FormField>
          <FormFieldLabel asChild>
            <label htmlFor="sheetId">Sheet</label>
          </FormFieldLabel>
          <FormFieldContent>
            <Controller
              control={control}
              name="sheetId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger asChild>
                    <Button isDisabled={isSubmitting}>
                      <SelectTriggerContent placeholder="Select a sheet..." />
                    </Button>
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((sheet) => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        <SelectItemContent>{sheet.name}</SelectItemContent>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.sheetId && (
              <FormFieldError>{errors.sheetId.message}</FormFieldError>
            )}
          </FormFieldContent>
        </FormField>
      </div>

      <div className="space-y-4">
        <div>
          <Typography variant="bodyMd" className="font-medium">
            Default Settings
          </Typography>
          <Typography variant="bodySm" className="text-text-muted">
            Set this pricing model as the default for customer types
          </Typography>
        </div>

        <div className="space-y-3">
          <FormField>
            <FormFieldContent>
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="isDefaultB2C"
                  render={({ field }) => (
                    <Checkbox
                      id="isDefaultB2C"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      isDisabled={isSubmitting}
                    />
                  )}
                />
                <FormFieldLabel asChild>
                  <label htmlFor="isDefaultB2C">
                    Set as default B2C pricing model
                  </label>
                </FormFieldLabel>
              </div>
            </FormFieldContent>
          </FormField>

          <FormField>
            <FormFieldContent>
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="isDefaultB2B"
                  render={({ field }) => (
                    <Checkbox
                      id="isDefaultB2B"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      isDisabled={isSubmitting}
                    />
                  )}
                />
                <FormFieldLabel asChild>
                  <label htmlFor="isDefaultB2B">
                    Set as default B2B pricing model
                  </label>
                </FormFieldLabel>
              </div>
            </FormFieldContent>
          </FormField>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Typography variant="bodyMd" className="font-medium">
            Required Cell Mappings
          </Typography>
          <Typography variant="bodySm" className="text-text-muted">
            These fields are required for the pricing model to work
          </Typography>
        </div>

        {renderCellMappingFields(requiredCellMappingFields)}
      </div>

      <div className="space-y-4">
        <div>
          <Typography variant="bodyMd" className="font-medium">
            Optional Cell Mappings
          </Typography>
          <Typography variant="bodySm" className="text-text-muted">
            Additional fields that can enhance the pricing model
          </Typography>
        </div>

        {renderCellMappingFields(optionalCellMappingFields)}
      </div>

      <Button type="submit" colorRole="brand" isDisabled={isSubmitting}>
        <ButtonContent iconLeft={IconPlus} isLoading={isSubmitting}>
          Create Pricing Model
        </ButtonContent>
      </Button>
    </form>
  );
};

export default PricingModelsForm;
