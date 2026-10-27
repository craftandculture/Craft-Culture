import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

import memberLinks from '../constants/memberLinks';
import type { ReleaseNote } from '../types';

const draftSchema = z.object({
  updates: z.array(
    z.object({
      hash: z.string().describe('The hash of the changelog item this is about, copied exactly'),
      memberFacing: z.boolean().describe('True only if a member would notice this change'),
      skippedReason: z
        .string()
        .nullable()
        .describe('When not member-facing: one short sentence saying why, for staff'),
      audiences: z
        .array(z.enum(['collector', 'wine_partner']))
        .describe('collector = Private Cellar members; wine_partner = trade partners. Empty when not member-facing'),
      type: z.enum(['feature', 'improvement', 'fix']),
      title: z.string().describe('Member-facing title, under 70 characters, sentence case'),
      body: z.string().describe('One or two sentences for the member'),
      linkPath: z.string().nullable().describe('One of the listed screens, or null'),
    }),
  ),
});

const SYSTEM = `You write the "What's New" page for Craft & Culture's members. Craft & Culture keeps fine wine in its bonded warehouse for two kinds of member:

1. Private Cellar members ("collector"): high-value private collectors. Their portal shows their collection, valuations, deliveries, sales of their wine, statements, invoices, purchases and the C&C Cellar List of wine they can add (always call it the C&C Cellar List).
2. Trade partners ("wine_partner"): wine businesses who hold stock with us and place private client orders for their clients through the partner portal.

You are given changelog items written by and for C&C staff. For each one decide whether a member would notice it, and if so write it for them.

Not member-facing (memberFacing false, with a short skippedReason): staff and admin screens, the warehouse and scanners, Zoho, pricing tools, logistics, Slack posts, internal reports, imports, security and infrastructure, anything only staff see.

Writing rules, followed exactly:
- Professional British English, written to the member ("your collection", "you can now"). Calm and plain, like a private bank or a fine wine merchant.
- Collector-led. Never say "release", "parcel", "call forward", "PCO", "SKU", "LWIN", "Zoho", "admin" or any internal term. Say "request a delivery", "your collection", "your private cellar".
- Never name a location such as Ras Al Khaimah or RAK. Say "our bonded warehouse".
- Never mention fees, charges or prices paid.
- No exclamation marks. No em or en dashes; write two sentences instead.
- A fix states calmly what now works, for example "Delivery dates now show correctly on your timeline". Never say "bug", "error" or "issue".
- Trade partner copy must never name a distributor, buyer or outlet (for example City Drinks).
- Title under 70 characters, sentence case, no full stop. Body one or two sentences, under 300 characters.
- type: feature for something new a member can do or see, improvement for something that works better, fix for something that now works correctly.

Screens a Private Cellar update may link to (linkPath), or null:
${memberLinks.collector.map((link) => `- ${link.path}: ${link.about}`).join('\n')}
Trade partner updates use null.`;

/**
 * Ask the AI to turn staff changelog items into member updates
 *
 * Returns one answer per item it was given; anything it drops or invents is
 * filtered out by hash, and a link outside the allowed list is removed.
 *
 * @param notes - Changelog items, with their staff notes
 * @returns The AI's decision and wording for each item
 */
const draftMemberUpdates = async (notes: ReleaseNote[]) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set, so updates cannot be drafted');
  }

  const anthropic = createAnthropic({ apiKey });
  const items = notes
    .map((note) =>
      [
        `hash: ${note.hash}`,
        `section: ${note.type}`,
        `item: ${note.text}`,
        ...note.notes.map((n) => `  - ${n}`),
      ].join('\n'),
    )
    .join('\n\n');

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: draftSchema,
    system: SYSTEM,
    prompt: `Changelog items:\n\n${items}\n\nReturn one entry for every item, in the same order.`,
  });

  const allowedLinks = new Set(memberLinks.collector.map((link) => link.path));
  const known = new Set(notes.map((note) => note.hash));

  return object.updates
    .filter((update) => known.has(update.hash))
    .map((update) => ({
      ...update,
      linkPath: update.linkPath && allowedLinks.has(update.linkPath) ? update.linkPath : null,
    }));
};

export default draftMemberUpdates;
