import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  partnerMembers,
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB (keeps under Vercel body limit after base64)

const uploadDeliveryPhotoSchema = z.object({
  orderId: z.string().uuid(),
  file: z.string().min(1, 'File is required'),
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(['image/png', 'image/jpeg', 'image/jpg']),
  notes: z.string().optional(),
});

/**
 * Upload proof of delivery photo
 *
 * Distributor procedure to upload a photo as proof of delivery.
 * This can be done independently of marking the order as delivered.
 * Typically shows package on doorstep with ID or signature.
 */
const distributorUploadDeliveryPhoto = distributorProcedure
  .input(uploadDeliveryPhotoSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, file, filename, fileType, notes } = input;
    const { partnerId, user } = ctx;

    // Verify order belongs to this distributor
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId, distributorId: partnerId },
      columns: { id: true, status: true, partnerId: true, orderNumber: true, deliveryPhoto: true },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not assigned to you',
      });
    }

    // Extract base64 data
    const base64Data = file.split(',')[1];
    if (!base64Data) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid file format. Expected base64 data URL.',
      });
    }

    // Convert to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Sanitize filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const blobFilename = `delivery-photos/${partnerId}/${orderId}/${timestamp}-${sanitizedFilename}`;

    // Upload to Vercel Blob
    const blob = await put(blobFilename, buffer, {
      access: 'public',
      contentType: fileType,
    });

    const now = new Date();

    // Update order with delivery photo URL
    await db
      .update(privateClientOrders)
      .set({
        deliveryPhoto: blob.url,
        updatedAt: now,
      })
      .where(eq(privateClientOrders.id, orderId));

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'delivery_photo_uploaded',
      notes: notes ?? 'Delivery proof photo uploaded',
      metadata: {
        photoUrl: blob.url,
        filename: sanitizedFilename,
        previousPhotoUrl: order.deliveryPhoto,
      },
    });

    // Notify partner
    if (order.partnerId) {
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      const orderRef = order.orderNumber ?? orderId;

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          partnerId: order.partnerId,
          type: 'status_update',
          title: 'Proof of Delivery Uploaded',
          message: `Proof of delivery uploaded for order ${orderRef}`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    return {
      photoUrl: blob.url,
      orderId,
      uploadedAt: now.toISOString(),
    };
  });

export default distributorUploadDeliveryPhoto;
