import { eq } from 'drizzle-orm';
import sharp from 'sharp';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import uploadLogoSchema from '../schemas/uploadLogoSchema';

/**
 * Upload company logo and store as optimized base64 data URL
 */
const logoUpload = protectedProcedure
  .input(uploadLogoSchema)
  .mutation(async ({ input: { file }, ctx: { user } }) => {
    // Convert base64 to buffer
    const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 2MB)
    if (buffer.length > 2 * 1024 * 1024) {
      throw new Error('File size must be less than 2MB');
    }

    // Optimize and resize image using sharp
    const optimizedImage = await sharp(buffer)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ quality: 90 })
      .toBuffer();

    // Convert optimized image to base64 data URL
    const optimizedBase64 = optimizedImage.toString('base64');
    const dataUrl = `data:image/png;base64,${optimizedBase64}`;

    // Update user record with new logo data URL
    const [updatedUser] = await db
      .update(users)
      .set({ companyLogo: dataUrl })
      .where(eq(users.id, user.id))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update logo');
    }

    return {
      success: true,
      logoUrl: updatedUser.companyLogo,
    };
  });

export default logoUpload;
