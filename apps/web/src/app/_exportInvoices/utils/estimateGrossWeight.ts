import { HS_SPARKLING_WINE } from '../constants';
import type { ExportLine } from '../schemas/exportDocumentSchema';

/** A wooden pallet plus wrap and corner boards */
const PALLET_KG = 27;

/**
 * Weight of one full bottle
 *
 * Sparkling glass is heavier. The figures are those EXP-2026-0040 and 0041
 * were declared on.
 *
 * @param sizeCl - Bottle size
 * @param sparkling - Whether it is sparkling wine
 * @returns Kilograms
 */
const bottleKg = (sizeCl: number, sparkling: boolean) => {
  if (sizeCl === 75) return sparkling ? 1.75 : 1.35;
  if (sizeCl === 150) return 2.85;
  if (sizeCl === 300) return 5.2;
  if (sizeCl === 600) return 9;
  return (sizeCl / 75) * 1.35;
};

/**
 * Weight of the carton or wooden case itself
 *
 * @param line - The line
 * @returns Kilograms per pack
 */
const caseKg = (line: ExportLine) => {
  if (line.kind === 'mixedCase') return 0.8;
  if (line.bottleSizeCl >= 600) return 4;
  if (line.bottleSizeCl >= 150) return line.packBottles >= 3 ? 2.5 : 1.2;
  if (line.packBottles >= 12) return 3.5;
  if (line.packBottles >= 5) return 2;
  if (line.packBottles >= 3) return 1.3;
  return 0.8;
};

/**
 * Estimate the shipment's gross weight
 *
 * Wine, packaging and pallets, from typical weights. It is an estimate and the
 * document says so until someone types a weighed figure over it.
 *
 * @example
 *   estimateGrossWeight(lines, 2); // 756
 *
 * @param lines - The export lines
 * @param pallets - Number of pallets, if known
 * @returns Whole kilograms
 */
const estimateGrossWeight = (lines: ExportLine[], pallets: number | null) => {
  const total = lines.reduce((sum, line) => {
    const sparkling = line.hsCode === HS_SPARKLING_WINE;
    const wine = line.qty * line.packBottles * bottleKg(line.bottleSizeCl, sparkling);
    return sum + wine + line.qty * caseKg(line);
  }, 0);
  return Math.round(total + (pallets ?? 0) * PALLET_KG);
};

export default estimateGrossWeight;
