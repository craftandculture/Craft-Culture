import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { type CellarApplication, partners } from '@/database/schema';

/**
 * Copy what the applicant has told us onto their cellar, once one exists
 *
 * The application is where answers are saved while the person is still
 * filling it in; the partner record is what the rest of the platform reads
 * (releases, the admin's member screen). Only fields actually given are
 * written, so a skipped step never blanks something an admin entered.
 *
 * @param application - The application, after the latest save
 */
const syncApplicantProfile = async (application: CellarApplication) => {
  if (!application.partnerId) return;

  const fields = {
    ...(application.fullName?.trim() && { businessName: application.fullName.trim() }),
    ...(application.phone?.trim() && { businessPhone: application.phone.trim() }),
    ...(application.deliveryAddress?.trim() && {
      deliveryAddress: application.deliveryAddress.trim(),
    }),
    ...(application.eidNumber?.trim() && { eidNumber: application.eidNumber.trim() }),
    ...(application.eidExpiry && { eidExpiry: new Date(application.eidExpiry) }),
  };

  if (Object.keys(fields).length === 0) return;

  await db.update(partners).set(fields).where(eq(partners.id, application.partnerId));
};

export default syncApplicantProfile;
