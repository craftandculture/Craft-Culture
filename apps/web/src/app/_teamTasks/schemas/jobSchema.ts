import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

export const partInputSchema = z.object({
  /** Present when editing an existing part */
  id: z.string().uuid().optional(),
  ownerId: z.string().uuid(),
  what: z.string().trim().min(1, 'Say what this person does'),
  due: isoDate.nullable(),
  /** Index, within this same list, of the part that must finish first */
  waitsForIndex: z.number().int().min(0).nullable(),
});

/**
 * A job as entered on the add or edit form
 *
 * Urgent jobs must carry a due date on every part: "urgent" with no date
 * cannot be ordered against other urgent work.
 */
const jobSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the job a title'),
    areaId: z.string().uuid().nullable(),
    newAreaName: z.string().trim().min(1).max(60).nullable(),
    forTag: z.enum(['client', 'distributor']).nullable(),
    urgent: z.boolean(),
    waitingOn: z.string().trim().max(120).nullable(),
    repeat: z.enum(['weekly', 'monthly']).nullable(),
    parts: z.array(partInputSchema).max(12),
  })
  .refine((job) => job.areaId || job.newAreaName, {
    message: 'Choose an area or name a new one',
    path: ['areaId'],
  })
  .refine((job) => !job.urgent || job.parts.every((p) => p.due), {
    message: 'Urgent jobs need a due date for every part',
    path: ['parts'],
  })
  .refine(
    (job) => job.parts.every((p, i) => p.waitsForIndex === null || (p.waitsForIndex !== i && p.waitsForIndex < job.parts.length)),
    { message: 'A part can only wait for another part of the same job', path: ['parts'] },
  );

export type JobInput = z.infer<typeof jobSchema>;

export default jobSchema;
