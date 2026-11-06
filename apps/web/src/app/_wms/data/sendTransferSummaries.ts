import { and, eq, gt, inArray, lte } from 'drizzle-orm';
import type { TransactionalVariables } from 'loops';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import { MEMBER_EMAIL_TEMPLATES } from '@/app/_cellar/constants/memberEmailEvents';
import buildEmailWines from '@/app/_cellar/data/buildEmailWines';
import getCellarHolderIds from '@/app/_cellar/data/getCellarHolderIds';
import queueMemberEmail from '@/app/_cellar/data/queueMemberEmail';
import { gulfDay } from '@/app/_cellar/utils/memberEmailTiming';
import createNotification from '@/app/_notifications/utils/createNotification';
import getCraftCultureOwnerIds from '@/app/_partners/data/getCraftCultureOwnerIds';
import { ORDER_EMAIL_TEMPLATE_ID } from '@/app/_privateClientOrders/constants';
import { ORDER_EMAIL_SHADOW_INBOX } from '@/app/_privateClientOrders/data/getOrderEmailMode';
import getPartnerUsers from '@/app/_privateClientOrders/data/getPartnerUsers';
import db from '@/database/client';
import { partners, settings, users, wmsStockMovements } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getTransferSummaryMode from './getTransferSummaryMode';
import summariseTransfers, { type TransferLine, describeQuantity } from '../utils/summariseTransfers';

/** The last moment a summary run covered, so each transfer is told once */
const CURSOR_SETTING = 'transfer_emails.cursor';

const WINES_SHOWN = 8;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What the day's lines add up to, for the headline sentence */
const tally = (lines: TransferLine[]) => {
  const inBottles = lines.filter((line) => line.direction === 'in').reduce((sum, line) => sum + line.bottles, 0);
  const outBottles = lines.filter((line) => line.direction === 'out').reduce((sum, line) => sum + line.bottles, 0);
  return { inBottles, outBottles };
};

/** The orderUpdate template's variables for a trade partner's summary */
const partnerEmail = (lines: TransferLine[], partnerName: string, day: string) => {
  const { inBottles, outBottles } = tally(lines);
  const parts = [inBottles ? `${plural(inBottles, 'bottle')} transferred to you` : '', outBottles ? `${plural(outBottles, 'bottle')} transferred out` : '']
    .filter(Boolean)
    .join(' and ');
  const body = `Today's ownership changes on your stock at the C&C bonded warehouse: ${parts}. The wine itself has not moved, and your stock page already shows the new figures.`;
  const shown = lines.slice(0, WINES_SHOWN);
  const rest = lines.slice(WINES_SHOWN);

  return {
    subject: `Stock transfers today: ${plural(lines.length, 'change')} to your stock`,
    preheader: `${parts.charAt(0).toUpperCase()}${parts.slice(1)}.`,
    label: day,
    eyebrow: 'Stock transfers',
    headline: 'Your stock transfers today',
    name: partnerName,
    body,
    note: [] as { title: string; text: string }[],
    action: [] as { text: string }[],
    ctaLabel: 'View your stock',
    ctaUrl: `${serverConfig.appUrl}/platform/partner/stock`,
    secondary: [] as { label: string; url: string }[],
    steps: [] as unknown[],
    winesTitle: [{ title: `Transferred today · ${plural(lines.length, 'line')}` }],
    wines: shown.map((line) => ({ name: line.name, detail: line.what, quantity: describeQuantity(line) })),
    winesMore: rest.length ? [{ text: `And ${plural(rest.length, 'more line')}. The full record is on your stock page.` }] : [],
    rows: [] as { label: string; value: string }[],
  };
};

/** The cellarWines template's variables for a Private Cellar member's summary */
const memberEmail = async (lines: TransferLine[]) => {
  const { inBottles, outBottles } = tally(lines);
  const parts = [inBottles ? `${plural(inBottles, 'bottle')} added to your cellar` : '', outBottles ? `${plural(outBottles, 'bottle')} transferred from it` : '']
    .filter(Boolean)
    .join(' and ');
  const shown = lines.slice(0, WINES_SHOWN);
  const rest = lines.slice(WINES_SHOWN);

  return {
    subject: 'Today’s changes to your cellar',
    preheader: `${parts.charAt(0).toUpperCase()}${parts.slice(1)}.`,
    eyebrow: 'Cellar update',
    headline: 'Your cellar has been updated',
    body: `Today saw ${parts}. Your wine remains in the C&C bonded warehouse, and your cellar already shows each change.`,
    wines: await buildEmailWines(
      shown.map((line) => ({ name: line.name, lwin18: line.lwin18, quantity: `${line.what}, ${describeQuantity(line)}` })),
    ),
    _bottles: inBottles + outBottles,
    ctaLabel: 'View your cellar',
    ctaUrl: `${serverConfig.appUrl}/platform/cellar`,
    note: rest.length
      ? `A further ${plural(rest.length, 'wine')} also changed today. The full record is in your cellar.`
      : 'Each change is recorded in your cellar, where you may view it at any time.',
    reference: '',
  };
};

/**
 * Tell each owner, once a day, what changed hands on their stock
 *
 * Partners kept asking what had moved between accounts: Cult Wines to a
 * private client, Crurated to a Private Cellar, C&C to Cult Wines. Every
 * ownership transfer since the last run is gathered per owner, both sides,
 * into one summary: an email and a notice to a trade partner, a cellar
 * email to a member. C&C's own records are not written to.
 *
 * Off: nothing is sent and the window moves on, so no backlog is released
 * later. Shadow: each summary goes to Kevin, marked with who it was for.
 * Live: to the owner, a member's through the member outbox and its rules.
 *
 * @param now - The end of the window
 * @returns What happened this run
 */
const sendTransferSummaries = async (now: Date = new Date()) => {
  const mode = await getTransferSummaryMode();

  const [cursorRow] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, CURSOR_SETTING)).limit(1);
  const parsed = cursorRow?.value ? new Date(cursorRow.value) : null;
  const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const movements = await db
    .select({
      lwin18: wmsStockMovements.lwin18,
      productName: wmsStockMovements.productName,
      quantityCases: wmsStockMovements.quantityCases,
      quantityBottles: wmsStockMovements.quantityBottles,
      fromOwnerId: wmsStockMovements.fromOwnerId,
      toOwnerId: wmsStockMovements.toOwnerId,
    })
    .from(wmsStockMovements)
    .where(
      and(
        eq(wmsStockMovements.movementType, 'ownership_transfer'),
        gt(wmsStockMovements.performedAt, since),
        lte(wmsStockMovements.performedAt, now),
      ),
    );

  const result = { mode, movements: movements.length, owners: 0, sent: 0, failed: 0 };

  if (mode !== 'off' && movements.length) {
    const ccIds = await getCraftCultureOwnerIds();
    const ownerIds = [
      ...new Set(
        movements
          .filter((movement) => movement.fromOwnerId !== movement.toOwnerId)
          .flatMap((movement) => [movement.fromOwnerId, movement.toOwnerId])
          .filter((id): id is string => !!id && !ccIds.has(id)),
      ),
    ];

    const owners = ownerIds.length
      ? await db
          .select({ id: partners.id, name: partners.businessName, email: partners.businessEmail, type: partners.type })
          .from(partners)
          .where(inArray(partners.id, ownerIds))
      : [];

    const day = gulfDay(now);

    for (const owner of owners) {
      const isCollector = owner.type === 'private_collector';
      const lines = summariseTransfers(movements, owner.id, { ccIds, isCollector });
      if (!lines.length) continue;
      result.owners += 1;

      try {
        if (isCollector) {
          const data = await memberEmail(lines);

          if (mode === 'live') {
            result.sent += await queueMemberEmail({ kind: 'stockTransferred', partnerId: owner.id, entityId: `transfers:${day}`, data, at: now });
          } else {
            const holderIds = await getCellarHolderIds(owner.id);
            const holders = holderIds.length
              ? await db.select({ name: users.name, email: users.email }).from(users).where(inArray(users.id, holderIds))
              : [];
            for (const holder of holders) {
              await loops.sendTransactionalEmail({
                transactionalId: MEMBER_EMAIL_TEMPLATES.cellarWines,
                email: ORDER_EMAIL_SHADOW_INBOX,
                dataVariables: {
                  ...data,
                  name: holder.name ?? '',
                  subject: `[SHADOW for ${holder.name || holder.email} <${holder.email}>] ${data.subject}`,
                } as unknown as TransactionalVariables,
              });
              result.sent += 1;
            }
          }
          continue;
        }

        // The business address, or one person on the account: never every login
        const people = await getPartnerUsers(owner.id);
        const to = owner.email?.trim() || people.at(0)?.email?.trim();
        if (!to) {
          logger.warn('Transfer summary skipped: no address on the owner', { partnerId: owner.id });
          continue;
        }

        const data = partnerEmail(lines, owner.name, day);
        if (mode === 'shadow') data.subject = `[SHADOW for ${owner.name} <${to}>] ${data.subject}`;

        await loops.sendTransactionalEmail({
          transactionalId: ORDER_EMAIL_TEMPLATE_ID,
          email: mode === 'live' ? to : ORDER_EMAIL_SHADOW_INBOX,
          dataVariables: data as unknown as TransactionalVariables,
        });
        result.sent += 1;

        if (mode === 'live') {
          for (const userId of new Set(people.map((person) => person.id))) {
            await createNotification({
              userId,
              type: 'status_update',
              title: 'Stock transfers today',
              message: data.body,
              entityType: 'stock_transfers',
              actionUrl: '/platform/partner/stock',
              metadata: { day, lines: lines.length },
            }).catch(() => undefined);
          }
        }
      } catch (error) {
        result.failed += 1;
        logger.error('Transfer summary failed', {
          partnerId: owner.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await settingsUpdateController({ key: CURSOR_SETTING, value: now.toISOString() });

  return result;
};

export default sendTransferSummaries;
