'use server';

import { desc, eq, inArray, isNotNull } from 'drizzle-orm';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isStaff from '@/app/_distribution/utils/isStaff';
import { MIN_MARGIN, MIN_SCORE } from '@/app/_logistics/constants/lwinMatching';
import askWinelabsForLine from '@/app/_logistics/data/askWinelabsForLine';
import searchRegister from '@/app/_logistics/data/searchRegister';
import decideLwinMatch from '@/app/_logistics/utils/decideLwinMatch';
import parseWineName from '@/app/_logistics/utils/parseWineName';
import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';
import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, lwinWines } from '@/database/schema';

export interface InboundMatchTestRow {
  shipment: string;
  line: string;
  confirmed: string;
  confirmedName: string | null;
  register: string | null;
  winelabs: string | null;
  winelabsName: string | null;
  winelabsFit: number | null;
  /** What the matcher as built would write: Wine Labs, then the register */
  pipeline: string | null;
  pipelineSource: 'winelabs' | 'register' | null;
}

export interface InboundMatchTestResult {
  tested: number;
  /** Lines skipped because the matcher had replaced the supplier's wording with the register's name */
  skippedRenamed: number;
  register: { auto: number; right: number };
  winelabs: { answered: number; right: number; auto: number; autoRight: number };
  pipeline: { auto: number; right: number; wrong: number; byWinelabs: number };
  rows: InboundMatchTestRow[];
  error: string | null;
}

/** A real LWIN18, not one of our 9xxxxxx internal codes */
const REAL_LWIN18 = /^[1-8]\d{6}-\d{4}-\d{2}-\d{5}$/;

/**
 * Measure inbound LWIN matching against lines staff have already confirmed
 *
 * Takes the most recent shipment lines that carry a real LWIN and still have
 * the supplier's own wording, and runs both matchers over them: our LWIN
 * register alone (as it was), and Wine Labs first with the register behind it
 * (as it is now). Each answer is compared with the confirmed LWIN7. Lines the
 * old matcher renamed to the register's name are left out, since matching a
 * record against its own name proves nothing. Nothing is written. About 8
 * credits a line.
 *
 * @param _previous - The last result, unused (useActionState)
 * @param formData - `size`: lines to test, 1 to 60; `skip`: lines to pass over, to continue a run
 * @returns Counts for each matcher, and every line where an answer differed from the confirmed LWIN
 */
const runInboundMatchTest = async (
  _previous: InboundMatchTestResult | null,
  formData: FormData,
): Promise<InboundMatchTestResult> => {
  const empty: InboundMatchTestResult = {
    tested: 0,
    skippedRenamed: 0,
    register: { auto: 0, right: 0 },
    winelabs: { answered: 0, right: 0, auto: 0, autoRight: 0 },
    pipeline: { auto: 0, right: 0, wrong: 0, byWinelabs: 0 },
    rows: [],
    error: null,
  };
  const user = await getCurrentUser();
  if (!isStaff(user)) return { ...empty, error: 'C&C staff only.' };

  const size = Math.min(60, Math.max(1, Math.round(Number(formData.get('size')) || 1)));
  const skip = Math.max(0, Math.round(Number(formData.get('skip')) || 0));

  const items = await db
    .select({
      shipment: logisticsShipments.shipmentNumber,
      productName: logisticsShipmentItems.productName,
      producer: logisticsShipmentItems.producer,
      vintage: logisticsShipmentItems.vintage,
      lwin: logisticsShipmentItems.lwin,
    })
    .from(logisticsShipmentItems)
    .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsShipmentItems.shipmentId))
    .where(isNotNull(logisticsShipmentItems.lwin))
    .orderBy(desc(logisticsShipments.createdAt))
    .limit(1500);

  const real = items.flatMap((item) => {
    const lwin18 = normalizeLwin18(item.lwin);
    return lwin18 && REAL_LWIN18.test(lwin18) ? [{ ...item, lwin7: lwin18.slice(0, 7) }] : [];
  });
  const lwin7s = [...new Set(real.map((item) => item.lwin7))];
  const register = lwin7s.length
    ? await db
        .select({ lwin: lwinWines.lwin, displayName: lwinWines.displayName })
        .from(lwinWines)
        .where(inArray(lwinWines.lwin, lwin7s))
    : [];
  const nameOf = new Map(register.map((wine) => [wine.lwin, wine.displayName]));

  // One test per distinct line: a wine bought on several invoices is one question
  const seen = new Set<string>();
  const usable = real.filter((item) => {
    const key = `${item.productName}|${item.lwin7}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const renamed = usable.filter(
    (item) => item.productName.trim().toLowerCase() === (nameOf.get(item.lwin7) ?? '').trim().toLowerCase(),
  );
  const lines = usable.filter((item) => !renamed.includes(item)).slice(skip, skip + size);

  const result: InboundMatchTestResult = { ...empty, skippedRenamed: renamed.length };

  for (const line of lines) {
    const parsed = parseWineName(line.productName);
    if (parsed.searchName.length < 3) continue;
    const producer = line.producer?.trim() ?? '';
    const withProducer =
      producer && !parsed.searchName.toLowerCase().includes(producer.toLowerCase())
        ? `${producer} ${parsed.searchName}`
        : parsed.searchName;
    const vintage = parsed.vintage ?? line.vintage;

    const candidates = await searchRegister(parsed.searchName, withProducer, Boolean(producer));
    const best = candidates[0];
    const score = Number(best?.score ?? 0);
    const margin = score - Number(candidates[1]?.score ?? 0);
    const registerAnswer = best && score >= MIN_SCORE && margin >= MIN_MARGIN ? best.lwin : null;

    let winelabs: Awaited<ReturnType<typeof askWinelabsForLine>> = null;
    try {
      winelabs = await askWinelabsForLine(withProducer, line.productName, vintage);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Wine Labs did not answer';
      break;
    }
    const lineText = `${withProducer} ${line.productName}`;
    const winelabsAnswer = winelabs?.name
      ? { lwin7: winelabs.lwin7, fit: winelabs.fit, producer: winelabs.record?.producerName ?? null }
      : null;
    const winelabsAuto = Boolean(winelabs && decideLwinMatch(lineText, winelabsAnswer, null));
    const decision = decideLwinMatch(lineText, winelabsAnswer, registerAnswer);
    const pipeline = decision?.lwin7 ?? null;

    result.tested += 1;
    if (registerAnswer) {
      result.register.auto += 1;
      if (registerAnswer === line.lwin7) result.register.right += 1;
    }
    if (winelabs) {
      result.winelabs.answered += 1;
      if (winelabs.lwin7 === line.lwin7) result.winelabs.right += 1;
      if (winelabsAuto) {
        result.winelabs.auto += 1;
        if (winelabs.lwin7 === line.lwin7) result.winelabs.autoRight += 1;
      }
    }
    if (pipeline) {
      result.pipeline.auto += 1;
      if (pipeline === line.lwin7) result.pipeline.right += 1;
      else result.pipeline.wrong += 1;
      if (decision?.source === 'winelabs') result.pipeline.byWinelabs += 1;
    }

    // Only the lines worth a look: an answer that differs from what staff confirmed
    if ((pipeline && pipeline !== line.lwin7) || (winelabs && winelabs.lwin7 !== line.lwin7)) {
      result.rows.push({
        shipment: line.shipment,
        line: line.productName,
        confirmed: line.lwin7,
        confirmedName: nameOf.get(line.lwin7) ?? null,
        register: registerAnswer,
        winelabs: winelabs?.lwin7 ?? null,
        winelabsName: winelabs?.name || null,
        winelabsFit: winelabs ? Math.round(winelabs.fit * 100) / 100 : null,
        pipeline,
        pipelineSource: decision?.source ?? null,
      });
    }
  }

  return result;
};

export default runInboundMatchTest;
