import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import serverConfig from '@/server.config';

import createAttioClient from '../attio/client';
import createMoneybirdClient from '../moneybird/client';

const createTRPCContext = async () => {
  const moneybird = createMoneybirdClient({
    apiKey: serverConfig.moneybirdApiKey,
    administrationId: serverConfig.moneybirdAdministrationId,
  });

  const attio = createAttioClient({
    apiKey: serverConfig.attioApiKey,
  });

  const user = await getCurrentUser();

  return {
    user,
    moneybird,
    attio,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

export default createTRPCContext;
