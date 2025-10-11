import { useFormContext, useWatch } from 'react-hook-form';

import { GetQuoteSchema } from '../schemas/getQuoteSchema';

const useLineItems = () => {
  const { control } = useFormContext<GetQuoteSchema>();

  const lineItems = useWatch({
    control,
    name: 'lineItems',
  });

  return lineItems.filter(
    (lineItem) =>
      typeof lineItem.productId === 'string' &&
      lineItem.productId !== '' &&
      typeof lineItem.quantity === 'number' &&
      lineItem.quantity > 0,
  ) as {
    productId: string;
    quantity: number;
  }[];
};

export default useLineItems;
