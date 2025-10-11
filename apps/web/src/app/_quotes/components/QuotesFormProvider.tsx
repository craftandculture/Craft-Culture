'use client';

import { FormProvider } from 'react-hook-form';

import useZodForm from '@/app/_ui/hooks/useZodForm';

import getQuoteSchema, { GetQuoteSchema } from '../schemas/getQuoteSchema';

const QuotesFormProvider = ({ children }: React.PropsWithChildren) => {
  const form = useZodForm(getQuoteSchema, {
    defaultValues: {
      lineItems: [{}],
    },
  });

  const onSubmit = async (data: GetQuoteSchema) => {
    console.log('Form submitted:', data);
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>{children}</form>
    </FormProvider>
  );
};

export default QuotesFormProvider;
