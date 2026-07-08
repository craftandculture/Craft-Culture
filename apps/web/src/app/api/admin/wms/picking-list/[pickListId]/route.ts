import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import type { PickingListLineItem } from '@/app/_wms/components/PickingListPDFTemplate';
import renderPickingListPDF from '@/app/_wms/utils/renderPickingListPDF';
import db from '@/database/client';
import { wmsLocations, wmsPickListItems, wmsPickLists, wmsStock } from '@/database/schema';

/**
 * Convert a stored bottle size (e.g. "75cl", "750ml") to a whole-number cl value
 *
 * @example
 *   bottleSizeToCl('750ml'); // returns 75
 *   bottleSizeToCl('75cl'); // returns 75
 *
 * @param bottleSize - The stored bottle size text
 * @returns The size expressed in centilitres
 */
const bottleSizeToCl = (bottleSize: string | null | undefined) => {
  if (!bottleSize) return 75;
  const match = bottleSize.trim().toLowerCase().match(/([\d.]+)\s*(cl|ml|l)?/);
  if (!match) return 75;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return 75;
  const unit = match[2] ?? 'cl';
  if (unit === 'ml') return Math.round(value / 10);
  if (unit === 'l') return Math.round(value * 100);
  return Math.round(value);
};

/**
 * Generate a printable picking list PDF for a WMS pick list
 *
 * GET /api/admin/wms/picking-list/[pickListId]
 *
 * Returns the PDF inline for viewing/printing in the browser. Lines are joined
 * to stock (pack config, producer, vintage) and locations (bin, storage
 * method), sorted by bin, with repack instructions derived for partial-case
 * bottle picks.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pickListId: string }> },
) {
  try {
    // Verify admin user
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pickListId } = await params;

    if (!pickListId) {
      return NextResponse.json({ error: 'pickListId is required' }, { status: 400 });
    }

    // Fetch the pick list header
    const [pickList] = await db
      .select()
      .from(wmsPickLists)
      .where(eq(wmsPickLists.id, pickListId));

    if (!pickList) {
      return NextResponse.json({ error: 'Pick list not found' }, { status: 404 });
    }

    // Fetch items joined to stock (pack config, producer, vintage) and
    // location (bin code, storage method)
    const rows = await db
      .select({
        id: wmsPickListItems.id,
        productName: wmsPickListItems.productName,
        quantityCases: wmsPickListItems.quantityCases,
        quantityBottles: wmsPickListItems.quantityBottles,
        stockProducer: wmsStock.producer,
        stockVintage: wmsStock.vintage,
        stockBottleSize: wmsStock.bottleSize,
        stockCaseConfig: wmsStock.caseConfig,
        locationCode: wmsLocations.locationCode,
        locationStorageMethod: wmsLocations.storageMethod,
      })
      .from(wmsPickListItems)
      .leftJoin(wmsStock, eq(wmsPickListItems.suggestedStockId, wmsStock.id))
      .leftJoin(wmsLocations, eq(wmsPickListItems.suggestedLocationId, wmsLocations.id))
      .where(eq(wmsPickListItems.pickListId, pickListId));

    // Sort by bin (aisle then bin), unlocated rows last
    const sortedRows = [...rows].sort((a, b) => {
      const binA = a.locationCode ?? '~';
      const binB = b.locationCode ?? '~';
      return binA.localeCompare(binB, 'en', { numeric: true });
    });

    // Map each row to a display line item, deriving repack instructions
    const items: PickingListLineItem[] = sortedRows.map((row, index) => {
      const bin = row.locationCode ?? '—';
      const caseConfig = row.stockCaseConfig ?? 12;
      const bottleSizeCl = bottleSizeToCl(row.stockBottleSize);
      const storageMethod: 'pallet' | 'shelf' =
        row.locationStorageMethod === 'pallet' ? 'pallet' : 'shelf';

      let qtyToPick: number;
      let qtyUnit: 'cases' | 'bottles';
      let isRepack = false;
      let repackInstruction: string | null = null;

      if (row.quantityBottles !== null && row.quantityBottles !== undefined) {
        qtyToPick = row.quantityBottles;
        qtyUnit = 'bottles';
        const remainder = caseConfig > 0 ? row.quantityBottles % caseConfig : 0;
        // A partial case (non-whole multiple of pack) requires a repack
        if (remainder !== 0) {
          isRepack = true;
          const bottlesFromCrackedCase = remainder;
          const returnBottles = caseConfig - bottlesFromCrackedCase;
          repackInstruction = `Break ${caseConfig}×${bottleSizeCl}cl case → pick ${bottlesFromCrackedCase} btl, return ${returnBottles} to ${bin}`;
        }
      } else {
        qtyToPick = row.quantityCases;
        qtyUnit = 'cases';
      }

      return {
        bin,
        storageMethod,
        productName: row.productName,
        producer: row.stockProducer,
        vintage: row.stockVintage ? String(row.stockVintage) : null,
        pack: `${caseConfig}x${bottleSizeCl}cl`,
        qtyToPick,
        qtyUnit,
        invLineNumber: index + 1,
        isRepack,
        repackInstruction,
      };
    });

    // Generate PDF
    const pdfBuffer = await renderPickingListPDF({
      pickListNumber: pickList.pickListNumber,
      orderRef: pickList.orderNumber,
      consignee: pickList.orderNumber,
      dispatchTo: '—',
      date: pickList.createdAt ?? new Date(),
      items,
    });

    // Return PDF inline for browser viewing/printing.
    // Wrap the Node Buffer in a Uint8Array so it satisfies the Web BodyInit type.
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Picking-List-${pickList.pickListNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Picking list PDF error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
