import { z } from 'zod';

import { cellarHolderProcedure } from '@/lib/trpc/procedures';

import storeIdentityDocument from '../data/storeIdentityDocument';

/**
 * Store a member's identity document, encrypted
 *
 * The checks and storage live in `storeIdentityDocument`, shared with the
 * onboarding application.
 */
const memberUploadIdentityDocument = cellarHolderProcedure
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
  .mutation(async ({ ctx, input }) =>
    storeIdentityDocument({
      partnerId: ctx.partner.id,
      uploadedBy: ctx.user.id,
      documentType: input.documentType,
      file: input.file,
      filename: input.filename,
    }),
  );

export default memberUploadIdentityDocument;
