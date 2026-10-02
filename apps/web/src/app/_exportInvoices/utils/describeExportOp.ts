import type { ExportDocument } from '../schemas/exportDocumentSchema';
import type { ExportOp } from '../schemas/exportOpSchema';

/**
 * Say what an edit op will do, in words an operator can check
 *
 * @example
 *   describeExportOp({ op: 'addColumn', key: 'abv', label: 'ABV' }, doc); // 'Add a column "ABV"'
 *
 * @param op - The op
 * @param doc - The document it applies to, for line numbers
 * @returns A short sentence
 */
const describeExportOp = (op: ExportOp, doc: ExportDocument) => {
  const lineNo = (id: string) => {
    const i = doc.lines.findIndex((l) => l.id === id);
    return i >= 0 ? `line ${i + 1}` : 'a line';
  };
  switch (op.op) {
    case 'setHeader':
      return `Set ${op.field} to ${op.value ?? 'blank'}`;
    case 'setConsignee':
      return 'Change the consignee block';
    case 'setLine':
      return `Set ${lineNo(op.lineId)} ${op.field} to ${op.value}`;
    case 'setLineBoe':
      return `Set ${lineNo(op.lineId)} BOE to ${op.boe ?? 'blank'}`;
    case 'overrideLine':
      return `Change ${lineNo(op.lineId)} away from Zoho${op.unitPrice !== undefined ? `, unit ${op.unitPrice}` : ''}${op.qty !== undefined ? `, qty ${op.qty}` : ''} (${op.reason})`;
    case 'splitLine':
      return `Split ${lineNo(op.lineId)} into ${op.parts.map((p) => `${p.qty} × ${p.packBottles}`).join(' + ')}`;
    case 'moveWineBetweenCases':
      return `Swap ${op.wine} (${lineNo(op.fromLineId)}) with ${op.swapWith} (${lineNo(op.toLineId)})`;
    case 'addColumn':
      return `Add a column "${op.label}"`;
    case 'removeColumn':
      return `Remove the ${op.key} column`;
    case 'setColumnValues':
      return `Fill ${op.key} on ${op.values.length} line${op.values.length === 1 ? '' : 's'}`;
    case 'addNote':
      return `Add the note "${op.text}"`;
    case 'removeNote':
      return `Remove note ${op.index + 1}`;
    case 'setDeclaration':
      return 'Replace the declaration';
    case 'setSectionNote':
      return `Set a section heading note: ${op.note ?? 'none'}`;
  }
};

export default describeExportOp;
