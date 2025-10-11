import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { StandardSchemaV1 } from '@trpc/server/unstable-core-do-not-import';
import { FieldValues, UseFormProps, useForm } from 'react-hook-form';

const useZodForm = <
  TOutput extends FieldValues = FieldValues,
  TContext = unknown,
>(
  schema: StandardSchemaV1<TOutput>,
  props?: Omit<UseFormProps<TOutput, TContext>, 'resolver'>,
) => {
  return useForm<TOutput, TContext>({
    resolver: standardSchemaResolver(schema),
    ...props,
  });
};

export default useZodForm;
