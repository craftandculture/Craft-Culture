import { asc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { users, wmsLocations, wmsPickListItems, wmsPickLists } from '@/database/schema';
import serverConfig from '@/server.config';

import describeOrder from './describeOrder';
import postWarehouseSlack from '../utils/postWarehouseSlack';

export type PickListEvent = 'released' | 'started' | 'completed' | 'cancelled';

const HEAD: Record<PickListEvent, string> = {
  released: ':clipboard: *New pick list*',
  started: ':runner: *Picking started*',
  completed: ':white_check_mark: *Pick complete*',
  cancelled: ':x: *Pick list cancelled*',
};

/**
 * Tell #warehouse-activity about a pick list: released, started, completed
 * or cancelled, with the order, who it is for, and every line on it
 *
 * Reads the list back from the database, so callers only pass its id.
 * Never throws: the warehouse keeps working if Slack does not.
 *
 * @param pickListId - The pick list
 * @param event - What just happened
 * @param actorName - Who did it, when known
 */
const announcePickList = async (pickListId: string, event: PickListEvent, actorName?: string | null) => {
  try {
    const [pl] = await db.select().from(wmsPickLists).where(eq(wmsPickLists.id, pickListId));
    if (!pl) return;

    const items = await db
      .select({
        name: wmsPickListItems.productName,
        cases: wmsPickListItems.quantityCases,
        bottles: wmsPickListItems.quantityBottles,
        picked: wmsPickListItems.pickedQuantity,
        location: wmsLocations.locationCode,
      })
      .from(wmsPickListItems)
      .leftJoin(wmsLocations, eq(wmsLocations.id, wmsPickListItems.suggestedLocationId))
      .where(eq(wmsPickListItems.pickListId, pickListId))
      .orderBy(asc(wmsLocations.locationCode));

    const [assignee] = pl.assignedTo
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, pl.assignedTo))
      : [];

    const order = await describeOrder(pl.orderId, pl.orderNumber);
    const link = `<${serverConfig.appUrl}/platform/admin/wms/pick/${pl.id}|${pl.pickListNumber}>`;

    const cases = items.reduce((n, i) => n + (i.bottles ? 0 : i.cases), 0);
    const bottles = items.reduce((n, i) => n + (i.bottles ?? 0), 0);
    const size = [cases && `${cases} case${cases === 1 ? '' : 's'}`, bottles && `${bottles} bottle${bottles === 1 ? '' : 's'}`]
      .filter(Boolean)
      .join(' + ');

    const lines = items
      .slice(0, 15)
      .map((i) => {
        const qty = i.bottles ? `${i.bottles} btl (split case)` : `${i.cases} cs`;
        return `• ${qty}  ${i.name}${i.location && event === 'released' ? `  _${i.location}_` : ''}`;
      });
    if (items.length > 15) lines.push(`…and ${items.length - 15} more lines`);

    let meta = `${items.length} line${items.length === 1 ? '' : 's'} · ${size || 'no quantities'}`;
    if (event === 'released' && assignee) meta += ` · assigned to ${assignee.name}`;
    if (event === 'started' && actorName) meta += ` · ${actorName}`;
    if (event === 'completed') {
      const mins = pl.startedAt && pl.completedAt ? Math.round((pl.completedAt.getTime() - pl.startedAt.getTime()) / 60000) : null;
      meta += `${actorName ? ` · by ${actorName}` : ''}${mins !== null ? ` · ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`}` : ''}`;
    }
    if (event === 'cancelled' && actorName) meta += ` · by ${actorName}`;

    const showLines = event === 'released' || event === 'completed';
    await postWarehouseSlack(
      [`${HEAD[event]} ${link} · ${order}`, meta, showLines ? lines.join('\n') : ''].filter(Boolean).join('\n'),
    );
  } catch {
    // Best effort only
  }
};

export default announcePickList;
