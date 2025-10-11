import getCurrentUser from '@/app/_auth/data/getCurrentUser';

const createTRPCContext = async () => {
  const user = await getCurrentUser();

  return {
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

export default createTRPCContext;
