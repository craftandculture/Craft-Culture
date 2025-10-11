'use client';

import { SelectTrigger } from '@radix-ui/react-select';
import { IconPlus } from '@tabler/icons-react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
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

const PricingModelsForm = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: sheets } = useSuspenseQuery(api.sheets.getMany.queryOptions());

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useZodForm(createPricingModelSchema, {
    defaultValues: {
      modelName: 'Example Pricing Model',
      isDefaultB2C: false,
      isDefaultB2B: false,
      // Column ranges
      name: "'Example Pricing Model'!A7:A16",
      region: "'Example Pricing Model'!B7:B16",
      producer: "'Example Pricing Model'!C7:C16",
      vintage: "'Example Pricing Model'!D7:D16",
      quantity: "'Example Pricing Model'!E7:E16",
      unitCount: "'Example Pricing Model'!F7:F16",
      unitSize: "'Example Pricing Model'!G7:G16",
      source: "'Example Pricing Model'!H7:H16",
      price: "'Example Pricing Model'!I7:I16",
      currency: "'Example Pricing Model'!J7:J16",
      exchangeRateUsd: "'Example Pricing Model'!K7:K16",
      basePriceUsd: "'Example Pricing Model'!L7:L16",
      priceUsd: "'Example Pricing Model'!Q7:Q16",
      // Single cells
      customerName: "'Example Pricing Model'!B1",
      customerEmail: "'Example Pricing Model'!B2",
      customerType: "'Example Pricing Model'!B3",
      finalPriceUsd: "'Example Pricing Model'!B4",
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

  if (sheets.length === 0) {
    return (
      <Typography variant="bodySm" className="text-text-muted">
        Please upload a sheet first before creating a pricing model.
      </Typography>
    );
  }

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

        <div className="border-border-primary overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-text-primary px-4 py-3 text-left text-sm font-medium">
                  Field
                </th>
                <th className="text-text-primary px-4 py-3 text-left text-sm font-medium">
                  Cell Reference
                </th>
              </tr>
            </thead>
            <tbody className="divide-border-primary divide-y">
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Price USD *
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (required, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!Q7:Q16"
                    isDisabled={isSubmitting}
                    {...register('priceUsd')}
                  />
                  {errors.priceUsd && (
                    <FormFieldError>{errors.priceUsd.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Final Price USD *
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Single cell (required)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!B4"
                    isDisabled={isSubmitting}
                    {...register('finalPriceUsd')}
                  />
                  {errors.finalPriceUsd && (
                    <FormFieldError>
                      {errors.finalPriceUsd.message}
                    </FormFieldError>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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

        <div className="border-border-primary overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-text-primary px-4 py-3 text-left text-sm font-medium">
                  Field
                </th>
                <th className="text-text-primary px-4 py-3 text-left text-sm font-medium">
                  Cell Reference
                </th>
              </tr>
            </thead>
            <tbody className="divide-border-primary divide-y">
              {/* Column Ranges - Product Data */}
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Name
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!A7:A16"
                    isDisabled={isSubmitting}
                    {...register('name')}
                  />
                  {errors.name && (
                    <FormFieldError>{errors.name.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Region
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!B7:B16"
                    isDisabled={isSubmitting}
                    {...register('region')}
                  />
                  {errors.region && (
                    <FormFieldError>{errors.region.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Producer
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!C7:C16"
                    isDisabled={isSubmitting}
                    {...register('producer')}
                  />
                  {errors.producer && (
                    <FormFieldError>{errors.producer.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Vintage
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!D7:D16"
                    isDisabled={isSubmitting}
                    {...register('vintage')}
                  />
                  {errors.vintage && (
                    <FormFieldError>{errors.vintage.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Quantity
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!E7:E16"
                    isDisabled={isSubmitting}
                    {...register('quantity')}
                  />
                  {errors.quantity && (
                    <FormFieldError>{errors.quantity.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Unit Count
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!F7:F16"
                    isDisabled={isSubmitting}
                    {...register('unitCount')}
                  />
                  {errors.unitCount && (
                    <FormFieldError>{errors.unitCount.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Unit Size
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!G7:G16"
                    isDisabled={isSubmitting}
                    {...register('unitSize')}
                  />
                  {errors.unitSize && (
                    <FormFieldError>{errors.unitSize.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Source
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!H7:H16"
                    isDisabled={isSubmitting}
                    {...register('source')}
                  />
                  {errors.source && (
                    <FormFieldError>{errors.source.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Price
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!I7:I16"
                    isDisabled={isSubmitting}
                    {...register('price')}
                  />
                  {errors.price && (
                    <FormFieldError>{errors.price.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Currency
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!J7:J16"
                    isDisabled={isSubmitting}
                    {...register('currency')}
                  />
                  {errors.currency && (
                    <FormFieldError>{errors.currency.message}</FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Exchange Rate USD
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!K7:K16"
                    isDisabled={isSubmitting}
                    {...register('exchangeRateUsd')}
                  />
                  {errors.exchangeRateUsd && (
                    <FormFieldError>
                      {errors.exchangeRateUsd.message}
                    </FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Base Price USD
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Column range (optional, max 10 rows)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!L7:L16"
                    isDisabled={isSubmitting}
                    {...register('basePriceUsd')}
                  />
                  {errors.basePriceUsd && (
                    <FormFieldError>
                      {errors.basePriceUsd.message}
                    </FormFieldError>
                  )}
                </td>
              </tr>

              {/* Single Cells - Customer Data */}
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Customer Name
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Single cell (optional)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!B1"
                    isDisabled={isSubmitting}
                    {...register('customerName')}
                  />
                  {errors.customerName && (
                    <FormFieldError>
                      {errors.customerName.message}
                    </FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Customer Email
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Single cell (optional)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!B2"
                    isDisabled={isSubmitting}
                    {...register('customerEmail')}
                  />
                  {errors.customerEmail && (
                    <FormFieldError>
                      {errors.customerEmail.message}
                    </FormFieldError>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <Typography variant="bodySm" className="font-medium">
                    Customer Type
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    Single cell (optional)
                  </Typography>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="text"
                    placeholder="'Example Pricing Model'!B3"
                    isDisabled={isSubmitting}
                    {...register('customerType')}
                  />
                  {errors.customerType && (
                    <FormFieldError>
                      {errors.customerType.message}
                    </FormFieldError>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
