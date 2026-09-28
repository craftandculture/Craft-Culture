import { z } from 'zod';

import { PCO_NOTE_MAX_LENGTH } from '../constants';

/**
 * Input for adding a note to a PCO's timeline
 */
const addNoteSchema = z.object({
  orderId: z.string().uuid(),
  note: z
    .string()
    .trim()
    .min(1, 'Write a note first')
    .max(PCO_NOTE_MAX_LENGTH, `Notes are limited to ${PCO_NOTE_MAX_LENGTH} characters`),
});

export default addNoteSchema;
