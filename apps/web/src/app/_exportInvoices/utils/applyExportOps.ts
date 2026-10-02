import estimateGrossWeight from './estimateGrossWeight';
import roundMoney from './roundMoney';
import type { ExportDocument, ExportLine } from '../schemas/exportDocumentSchema';
import type { ExportOp } from '../schemas/exportOpSchema';

/**
 * Describe a mixed case from the wines in it
 *
 * @param line - A mixed-case line
 * @returns Description, origin and unit price recomputed from its components
 */
const recomputeMixedCase = (line: ExportLine) => {
  const names = [...new Set(line.components.map((c) => c.description))];
  line.description = names.length === 1 ? (names[0] ?? '') : `Mixed case: ${names.join('; ')}`;
  line.origin = [...new Set(line.components.map((c) => c.origin))].join(' / ');
  line.packBottles = line.components.length;
  line.unitPrice = roundMoney(line.components.reduce((sum, c) => sum + c.unitPrice, 0));
  line.amount = roundMoney(line.unitPrice * line.qty);
};

/**
 * Apply edit ops to an export document
 *
 * Pure: returns a new document and never touches the one passed in, so a
 * proposed change can be previewed — with the checks re-run — before anyone
 * accepts it. An op that cannot apply throws with a sentence a user can act
 * on, rather than being skipped.
 *
 * @example
 *   const next = applyExportOps(doc, [{ op: 'setHeader', field: 'pallets', value: 2 }]);
 *
 * @param doc - The current document
 * @param ops - Ops in the order they should apply
 * @returns The changed document
 */
const applyExportOps = (doc: ExportDocument, ops: ExportOp[]) => {
  const next = structuredClone(doc);

  const lineById = (id: string) => {
    const line = next.lines.find((l) => l.id === id);
    if (!line) throw new Error(`There is no line ${id} on this document.`);
    return line;
  };

  for (const op of ops) {
    switch (op.op) {
      case 'setHeader': {
        const { field, value } = op;
        if (field === 'date' || field === 'terms') {
          if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} needs a value.`);
          next.header[field] = value.trim();
        } else {
          if (value !== null && typeof value !== 'number') throw new Error(`${field} must be a number.`);
          if (field === 'grossWeightKg') {
            // Clearing a weighed figure goes back to the estimate
            next.header.grossWeightEstimated = value === null;
            next.header.grossWeightKg =
              value === null ? estimateGrossWeight(next.lines, next.header.pallets) : value;
          } else {
            next.header[field] = value === null ? null : Math.round(value);
          }
          if (field === 'pallets' && next.header.grossWeightEstimated) {
            next.header.grossWeightKg = estimateGrossWeight(next.lines, next.header.pallets);
          }
        }
        break;
      }
      case 'setConsignee': {
        if (op.name !== undefined) next.header.consignee.name = op.name;
        if (op.addressLines !== undefined) next.header.consignee.addressLines = op.addressLines;
        if (op.trn !== undefined) next.header.consignee.trn = op.trn;
        break;
      }
      case 'setLine': {
        const line = lineById(op.lineId);
        if (op.field === 'packBottles' || op.field === 'bottleSizeCl') {
          const n = Number(op.value);
          if (!Number.isFinite(n) || n <= 0) throw new Error(`${op.field} must be a positive number.`);
          line[op.field] = op.field === 'packBottles' ? Math.round(n) : n;
        } else {
          line[op.field] = String(op.value);
        }
        break;
      }
      case 'setLineBoe': {
        const line = lineById(op.lineId);
        const digits = op.boe?.replace(/\D/g, '') ?? '';
        line.boe = digits || null;
        break;
      }
      case 'overrideLine': {
        const line = lineById(op.lineId);
        line.override ??= {
          reason: op.reason,
          originalUnitPrice: line.unitPrice,
          originalQty: line.qty,
        };
        line.override.reason = op.reason;
        if (op.unitPrice !== undefined) line.unitPrice = roundMoney(op.unitPrice);
        if (op.qty !== undefined) line.qty = op.qty;
        line.amount = roundMoney(line.unitPrice * line.qty);
        if (
          line.unitPrice === line.override.originalUnitPrice &&
          line.qty === line.override.originalQty
        ) {
          line.override = null;
        }
        break;
      }
      case 'splitLine': {
        const index = next.lines.findIndex((l) => l.id === op.lineId);
        const line = next.lines[index];
        if (!line) throw new Error(`There is no line ${op.lineId} on this document.`);
        if (line.kind !== 'cased') throw new Error('Only a single-wine line can be split.');
        const bottles = line.qty * line.packBottles;
        const partBottles = op.parts.reduce((s, p) => s + p.packBottles * p.qty, 0);
        if (partBottles !== bottles) {
          throw new Error(
            `The parts hold ${partBottles} bottles but the line has ${bottles}. A split must keep every bottle; a change in bottles is a change to the Zoho invoice.`,
          );
        }
        let remaining = line.amount;
        const parts = op.parts.map((p, i) => {
          const isLast = i === op.parts.length - 1;
          const amount = isLast
            ? roundMoney(remaining)
            : roundMoney((line.amount * p.packBottles * p.qty) / bottles);
          remaining -= amount;
          return {
            ...structuredClone(line),
            id: `${line.id}.${i + 1}`,
            packBottles: p.packBottles,
            qty: p.qty,
            unitPrice: roundMoney(amount / p.qty),
            amount,
          };
        });
        next.lines.splice(index, 1, ...parts);
        break;
      }
      case 'moveWineBetweenCases': {
        const from = lineById(op.fromLineId);
        const to = lineById(op.toLineId);
        if (from.kind !== 'mixedCase' || to.kind !== 'mixedCase') {
          throw new Error('Wines can only be moved between mixed cases.');
        }
        if (from.qty !== to.qty) {
          throw new Error('Both cases must be on the same orders (the same qty) to swap a wine.');
        }
        const match = (desc: string, q: string) => desc.toLowerCase().includes(q.toLowerCase());
        const a = from.components.findIndex((c) => match(c.description, op.wine));
        const b = to.components.findIndex((c) => match(c.description, op.swapWith));
        const ca = from.components[a];
        const cb = to.components[b];
        if (!ca || !cb) throw new Error('One of those wines is not in the case named.');
        from.components[a] = cb;
        to.components[b] = ca;
        recomputeMixedCase(from);
        recomputeMixedCase(to);
        break;
      }
      case 'addColumn': {
        if (next.extraColumns.some((c) => c.key === op.key)) {
          throw new Error(`There is already a ${op.label} column.`);
        }
        next.extraColumns.push({ key: op.key, label: op.label });
        break;
      }
      case 'removeColumn': {
        next.extraColumns = next.extraColumns.filter((c) => c.key !== op.key);
        next.lines.forEach((l) => delete l.extra[op.key]);
        break;
      }
      case 'setColumnValues': {
        if (!next.extraColumns.some((c) => c.key === op.key)) {
          throw new Error(`Add the ${op.key} column before filling it.`);
        }
        op.values.forEach(({ lineId, value }) => {
          lineById(lineId).extra[op.key] = value;
        });
        break;
      }
      case 'addNote':
        next.notes.push(op.text.trim());
        break;
      case 'removeNote':
        if (op.index >= next.notes.length) throw new Error('That note does not exist.');
        next.notes.splice(op.index, 1);
        break;
      case 'setDeclaration':
        next.declaration = op.text.trim();
        break;
      case 'setSectionNote': {
        const section = next.sections.find((s) => s.id === op.sectionId);
        if (!section) throw new Error(`There is no section ${op.sectionId}.`);
        section.note = op.note;
        break;
      }
    }
  }

  return next;
};

export default applyExportOps;
