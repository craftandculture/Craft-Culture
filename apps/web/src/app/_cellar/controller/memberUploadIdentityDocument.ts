import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { and, eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';

import db from '@/database/client';
import { partnerIdentityDocuments } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Store a member's identity document
 *
 * The declared MIME type is ignored in favour of sniffing the bytes. A file
 * named .png that is not a PNG is either a mistake or an attempt, and neither
 * should reach storage on the strength of its own claim about itself.
 *
 * Re-uploading a side replaces it. A member correcting a blurred photo should
 * end up with one readable copy, not two of which someone has to guess the
 * newer.
 */
const memberUploadIdentityDocument = stockOwnerProcedure
  .input(
    z.object({
      documentType: z.enum([
        'emirates_id_front',
        'emirates_id_back',
        'passport',
      ]),
      /*
        Bounded here rather than only after decoding. An unbounded string is
        parsed as JSON and held in memory, and the buffer allocated from it,
        before any size check runs — so the limit has to be part of validation.
        Base64 is roughly four bytes per three, hence the headroom over the
        10MB of actual file this permits.
      */
      file: z.string().max(14_000_000),
      /*
        No control characters. The name is echoed in a Content-Disposition
        header when the document is served back, and a CR or LF there is a way
        to append headers of somebody else's choosing.
      */
      filename: z
        .string()
        .max(255)
         
        .regex(/^[^\u0000-\u001f\u007f]+$/, 'That filename is not valid'),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.error('BLOB_READ_WRITE_TOKEN is not set');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'File storage is not configured.',
      });
    }

    const base64 = input.file.split(',')[1];

    if (!base64) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file' });
    }

    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length > MAX_BYTES) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'File must be under 10MB',
      });
    }

    const detected = await fileTypeFromBuffer(buffer);

    if (!detected || !ALLOWED_TYPES.includes(detected.mime)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Upload a PDF, JPEG, PNG or WebP',
      });
    }

    const safeName = input.filename.replace(/[^a-zA-Z0-9.-]/g, '_');

    /*
      Foldered under the partner and given a random suffix, because the blob
      is publicly reachable by anyone holding its URL. The URL is never
      returned to a browser — reads go through /api/cellar/identity — but the
      path should not be guessable from a member's name either.
    */
    const blob = await put(
      `identity/${ctx.partner.id}/${input.documentType}/${safeName}`,
      buffer,
      { access: 'public', contentType: detected.mime, addRandomSuffix: true },
    );

    await db
      .delete(partnerIdentityDocuments)
      .where(
        and(
          eq(partnerIdentityDocuments.partnerId, ctx.partner.id),
          eq(partnerIdentityDocuments.documentType, input.documentType),
        ),
      );

    await db.insert(partnerIdentityDocuments).values({
      partnerId: ctx.partner.id,
      documentType: input.documentType,
      fileUrl: blob.url,
      fileName: input.filename.replace(/["\\]/g, ''),
      mimeType: detected.mime,
      fileSize: buffer.length,
      uploadedBy: ctx.user.id,
    });

    return { uploaded: true, documentType: input.documentType };
  });

export default memberUploadIdentityDocument;
