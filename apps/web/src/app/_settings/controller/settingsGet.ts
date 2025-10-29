import db from '@/database/client';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get user settings (company information)
 */
const settingsGet = protectedProcedure.query(async ({ ctx: { user } }) => {
  const userSettings = await db.query.users.findFirst({
    where: { id: user.id },
    columns: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      companyLogo: true,
      companyAddress: true,
      companyPhone: true,
      companyEmail: true,
      companyWebsite: true,
      companyVatNumber: true,
      customerType: true,
    },
  });

  if (!userSettings) {
    throw new Error('User not found');
  }

  return userSettings;
});

export default settingsGet;
