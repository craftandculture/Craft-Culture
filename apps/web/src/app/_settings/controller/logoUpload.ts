import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import uploadLogoSchema from '../schemas/uploadLogoSchema';

/**
 * Upload company logo to Vercel Blob storage
 */
const logoUpload = protectedProcedure
  .input(uploadLogoSchema)
  .mutation(async ({ input: { file, filename }, ctx: { user } }) => {
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

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const blobFilename = `company-logos/${user.id}/${timestamp}-${sanitizedFilename}.png`;

    // Upload to Vercel Blob
    const blob = await put(blobFilename, optimizedImage, {
      access: 'public',
      contentType: 'image/png',
    });

    // Delete old logo if it exists
    if (user.companyLogo) {
      // TODO: Delete old blob from Vercel Blob storage
      // This requires the del() function from @vercel/blob
      // For now, we'll just update the database
    }

    // Update user record with new logo URL
    const [updatedUser] = await db
      .update(users)
      .set({ companyLogo: blob.url })
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
