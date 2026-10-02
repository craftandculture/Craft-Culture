import { z } from 'zod';

/** Line fields that can be changed freely — none of them move money */
export const editableLineFields = [
  'description',
  'hsCode',
  'origin',
  'packBottles',
  'bottleSizeCl',
] as const;

/** Header fields that can be changed freely */
export const editableHeaderFields = [
  'date',
  'terms',
  'pallets',
  'grossWeightKg',
  'casesOverride',
] as const;

/**
 * One change to an export invoice
 *
 * Every edit, from a cell typed on screen, from Claude or from a consignee's
 * standing rules, is one of these, so it can be shown before it is applied,
 * logged, and replayed on a rebuild. Money only moves through `overrideLine`,
 * which demands a reason and is flagged until Zoho agrees.
 */
export const exportOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('setHeader'),
    field: z.enum(editableHeaderFields),
    value: z.union([z.string(), z.number(), z.null()]),
  }),
  z.object({
    op: z.literal('setConsignee'),
    name: z.string().optional(),
    addressLines: z.array(z.string()).optional(),
    trn: z.string().nullable().optional(),
  }),
  z.object({
    op: z.literal('setLine'),
    lineId: z.string(),
    field: z.enum(editableLineFields),
    value: z.union([z.string(), z.number()]),
  }),
  z.object({
    op: z.literal('setLineBoe'),
    lineId: z.string(),
    boe: z.string().nullable(),
  }),
  z.object({
    op: z.literal('overrideLine'),
    lineId: z.string(),
    unitPrice: z.number().optional(),
    qty: z.number().int().nonnegative().optional(),
    reason: z.string().min(3),
  }),
  z.object({
    op: z.literal('splitLine'),
    lineId: z.string(),
    /** Each part's pack and qty; amounts are shared out so the total holds */
    parts: z
      .array(z.object({ packBottles: z.number().int().positive(), qty: z.number().int().positive() }))
      .min(2),
  }),
  z.object({
    op: z.literal('moveWineBetweenCases'),
    fromLineId: z.string(),
    toLineId: z.string(),
    wine: z.string(),
    swapWith: z.string(),
  }),
  z.object({
    op: z.literal('addColumn'),
    key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
    label: z.string(),
  }),
  z.object({ op: z.literal('removeColumn'), key: z.string() }),
  z.object({
    op: z.literal('setColumnValues'),
    key: z.string(),
    values: z.array(z.object({ lineId: z.string(), value: z.string() })),
  }),
  z.object({ op: z.literal('addNote'), text: z.string().min(1) }),
  z.object({ op: z.literal('removeNote'), index: z.number().int().nonnegative() }),
  z.object({ op: z.literal('setDeclaration'), text: z.string().min(1) }),
  z.object({
    op: z.literal('setSectionNote'),
    sectionId: z.string(),
    note: z.string().nullable(),
  }),
]);

export type ExportOp = z.infer<typeof exportOpSchema>;
