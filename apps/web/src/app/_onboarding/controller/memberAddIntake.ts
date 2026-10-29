import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { cellarIntakes, users } from '@/database/schema';
import { collectorProcedure } from '@/lib/trpc/procedures';

import cellarTeamEmails from '../constants/cellarTeamEmails';
import wineSources, { WINE_SOURCE_VALUES } from '../constants/wineSources';
import assertActivated from '../data/assertActivated';
import openTransferTasks from '../data/openTransferTasks';

/**
 * A member asks us to bring wine into their cellar
 *
 * Moving wine is an action, so a transfer from another cellar needs the
 * cellar activated first; telling us what they already hold with us, or what
 * they would like to buy, does not. Kevin and Laraine get a task and a
 * notification either way. All details are optional — we chase the holder.
 */
const memberAddIntake = collectorProcedure
  .input(
    z.object({
      source: z.enum(WINE_SOURCE_VALUES),
      holderName: z.string().trim().max(200).optional(),
      approxCases: z.number().int().min(0).max(100_000).optional(),
      note: z.string().trim().max(2000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const source = wineSources.find((item) => item.value === input.source)!;
    if (source.isTransfer) await assertActivated(ctx.partner.id);

    const [intake] = await db
      .insert(cellarIntakes)
      .values({
        partnerId: ctx.partner.id,
        source: input.source,
        holderName: input.holderName || (input.source === 'lcb' ? 'LCB' : null),
        approxCases: input.approxCases ?? null,
        note: input.note || null,
      })
      .returning();

    const memberName = ctx.partner.businessName;
    await openTransferTasks({ memberName, partnerId: ctx.partner.id, intakes: [intake!] });

    const team = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [...cellarTeamEmails]));
    await Promise.all(
      team.map((member) =>
        createNotification({
          userId: member.id,
          type: 'action_required',
          title: `${memberName}: ${source.label}`,
          message: [intake!.holderName, intake!.approxCases && `about ${intake!.approxCases} cases`, intake!.note]
            .filter(Boolean)
            .join(' · '),
          actionUrl: '/platform/admin/cellar-members?tab=intakes',
        }).catch(() => undefined),
      ),
    );

    return { intakeId: intake!.id };
  });

export default memberAddIntake;
