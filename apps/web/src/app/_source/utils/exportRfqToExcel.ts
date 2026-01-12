import * as XLSX from 'xlsx';

interface RfqItem {
  id: string;
  productName: string | null;
  producer?: string | null;
  vintage?: string | null;
  region?: string | null;
  country?: string | null;
  bottleSize?: string | null;
  caseConfig?: number | null;
  lwin?: string | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  selectedQuoteId?: string | null;
  finalPriceUsd?: number | null;
  calculatedPriceUsd?: number | null;
  adminNotes?: string | null;
  originalText?: string | null;
  sortOrder?: number | null;
  quotes: Array<{
    quote: {
      id: string;
      partnerId: string;
      costPricePerCaseUsd: number | null;
      quoteType: string;
      quotedVintage?: string | null;
      caseConfig?: string | null;
      bottleSize?: string | null;
      availableQuantity?: number | null;
      leadTimeDays?: number | null;
      stockLocation?: string | null;
      stockCondition?: string | null;
      moq?: number | null;
      currency?: string | null;
      notes?: string | null;
      notAvailableReason?: string | null;
      alternativeProductName?: string | null;
      alternativeProducer?: string | null;
      alternativeVintage?: string | null;
      alternativeRegion?: string | null;
      alternativeCountry?: string | null;
      alternativeBottleSize?: string | null;
      alternativeCaseConfig?: number | string | null;
      alternativeLwin?: string | null;
      alternativeReason?: string | null;
      isSelected: boolean;
    };
    partner: {
      id: string;
      businessName: string;
    };
  }>;
}

interface RfqPartner {
  partnerId: string;
  status: string;
  quoteCount: number;
  submittedAt?: Date | string | null;
  partnerNotes?: string | null;
  partner: {
    id: string;
    businessName: string;
  };
}

interface RfqData {
  rfqNumber: string;
  name: string;
  status: string;
  distributorCompany?: string | null;
  distributorName?: string | null;
  distributorEmail?: string | null;
  responseDeadline?: Date | string | null;
  createdAt?: Date | string | null;
  items: RfqItem[];
  partners: RfqPartner[];
}

/**
 * Export RFQ to comprehensive Excel workbook
 *
 * Creates a workbook with:
 * - Sheet 1: All Items (requested items with all details)
 * - Sheet 2: All Quotes (every quote received, one per row)
 * - Sheet 3: Selected Summary (what was selected with costs)
 * - Sheet 4: By Partner (breakdown by supplier)
 * - Sheet 5: Unquoted Items (items with no responses)
 *
 * @example
 *   exportRfqToExcel(rfqData);
 */
const exportRfqToExcel = (rfq: RfqData) => {
  const wb = XLSX.utils.book_new();

  // =========================================================
  // Sheet 1: ALL ITEMS (Customer Request)
  // =========================================================
  const itemsData: (string | number | null)[][] = [
    ['CUSTOMER REQUEST - ALL ITEMS'],
    [`RFQ: ${rfq.rfqNumber}`],
    [`Name: ${rfq.name}`],
    [`Customer: ${rfq.distributorCompany || '-'}`],
    [`Contact: ${rfq.distributorName || '-'}`],
    [`Status: ${rfq.status}`],
    [`Created: ${rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString() : '-'}`],
    [],
    [
      '#',
      'Product Name',
      'Producer',
      'Vintage',
      'Region',
      'Country',
      'Bottle Size',
      'Case Config',
      'LWIN',
      'Qty Requested',
      'Qty Unit',
      'Original Text',
      'Admin Notes',
      'Has Quotes',
      'Has Selection',
    ],
  ];

  rfq.items.forEach((item, idx) => {
    const hasQuotes = item.quotes.some((q) => q.quote.costPricePerCaseUsd !== null);
    const hasSelection = item.quotes.some((q) => q.quote.isSelected);

    itemsData.push([
      idx + 1,
      item.productName || '',
      item.producer || '',
      item.vintage || '',
      item.region || '',
      item.country || '',
      item.bottleSize || '',
      item.caseConfig || '',
      item.lwin || '',
      item.quantity || '',
      item.quantityUnit || 'cases',
      item.originalText || '',
      item.adminNotes || '',
      hasQuotes ? 'Yes' : 'No',
      hasSelection ? 'Yes' : 'No',
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(itemsData);
  ws1['!cols'] = [
    { wch: 4 },  // #
    { wch: 35 }, // Product Name
    { wch: 20 }, // Producer
    { wch: 8 },  // Vintage
    { wch: 15 }, // Region
    { wch: 12 }, // Country
    { wch: 10 }, // Bottle Size
    { wch: 10 }, // Case Config
    { wch: 20 }, // LWIN
    { wch: 12 }, // Qty Requested
    { wch: 10 }, // Qty Unit
    { wch: 40 }, // Original Text
    { wch: 25 }, // Admin Notes
    { wch: 10 }, // Has Quotes
    { wch: 12 }, // Has Selection
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'All Items');

  // =========================================================
  // Sheet 2: ALL QUOTES (Every quote, one per row)
  // =========================================================
  const quotesData: (string | number | null)[][] = [
    ['ALL QUOTES RECEIVED'],
    [`RFQ: ${rfq.rfqNumber}`],
    [],
    [
      'Item #',
      'Product Name',
      'Requested Vintage',
      'Requested Qty',
      'Qty Unit',
      'Partner',
      'Quote Type',
      'Quoted Vintage',
      'Price/Case (USD)',
      'Price/Bottle (USD)',
      'Currency',
      'Bottle Size',
      'Case Config',
      'Available Qty',
      'Lead Time (Days)',
      'Stock Location',
      'Stock Condition',
      'MOQ',
      'Partner Notes',
      'N/A Reason',
      'Alt Product',
      'Alt Producer',
      'Alt Vintage',
      'Alt Region',
      'Alt Country',
      'Alt Bottle Size',
      'Alt Case Config',
      'Alt LWIN',
      'Alt Reason',
      'Selected',
    ],
  ];

  rfq.items.forEach((item, idx) => {
    item.quotes.forEach((q) => {
      const quote = q.quote;
      const pricePerCase = quote.costPricePerCaseUsd;
      const caseConfig = quote.caseConfig ? Number(quote.caseConfig) : null;
      const pricePerBottle = pricePerCase && caseConfig ? pricePerCase / caseConfig : null;

      quotesData.push([
        idx + 1,
        item.productName || '',
        item.vintage || '',
        item.quantity || '',
        item.quantityUnit || 'cases',
        q.partner.businessName,
        quote.quoteType,
        quote.quotedVintage || '',
        pricePerCase,
        pricePerBottle ? Number(pricePerBottle.toFixed(2)) : null,
        quote.currency || 'USD',
        quote.bottleSize || '',
        quote.caseConfig || '',
        quote.availableQuantity || '',
        quote.leadTimeDays || '',
        quote.stockLocation || '',
        quote.stockCondition || '',
        quote.moq || '',
        quote.notes || '',
        quote.notAvailableReason || '',
        quote.alternativeProductName || '',
        quote.alternativeProducer || '',
        quote.alternativeVintage || '',
        quote.alternativeRegion || '',
        quote.alternativeCountry || '',
        quote.alternativeBottleSize || '',
        quote.alternativeCaseConfig || '',
        quote.alternativeLwin || '',
        quote.alternativeReason || '',
        quote.isSelected ? 'YES' : '',
      ]);
    });
  });

  const ws2 = XLSX.utils.aoa_to_sheet(quotesData);
  ws2['!cols'] = [
    { wch: 6 },  // Item #
    { wch: 30 }, // Product Name
    { wch: 10 }, // Requested Vintage
    { wch: 10 }, // Requested Qty
    { wch: 8 },  // Qty Unit
    { wch: 20 }, // Partner
    { wch: 12 }, // Quote Type
    { wch: 10 }, // Quoted Vintage
    { wch: 12 }, // Price/Case
    { wch: 12 }, // Price/Bottle
    { wch: 8 },  // Currency
    { wch: 10 }, // Bottle Size
    { wch: 10 }, // Case Config
    { wch: 10 }, // Available Qty
    { wch: 12 }, // Lead Time
    { wch: 15 }, // Stock Location
    { wch: 12 }, // Stock Condition
    { wch: 6 },  // MOQ
    { wch: 25 }, // Partner Notes
    { wch: 20 }, // N/A Reason
    { wch: 25 }, // Alt Product
    { wch: 15 }, // Alt Producer
    { wch: 10 }, // Alt Vintage
    { wch: 12 }, // Alt Region
    { wch: 10 }, // Alt Country
    { wch: 12 }, // Alt Bottle Size
    { wch: 12 }, // Alt Case Config
    { wch: 15 }, // Alt LWIN
    { wch: 20 }, // Alt Reason
    { wch: 8 },  // Selected
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'All Quotes');

  // =========================================================
  // Sheet 3: SELECTED SUMMARY (Final selections with pricing)
  // =========================================================
  const selectedData: (string | number | null)[][] = [
    ['SELECTED QUOTES - FINAL ORDER'],
    [`RFQ: ${rfq.rfqNumber}`],
    [`Customer: ${rfq.distributorCompany || '-'}`],
    [],
    [
      '#',
      'Product Name',
      'Producer',
      'Vintage',
      'Region',
      'Country',
      'Bottle Size',
      'Case Config',
      'LWIN',
      'Qty',
      'Unit',
      'Supplier',
      'Cost/Case',
      'Cost/Bottle',
      'Final/Case',
      'Final/Bottle',
      'Line Total',
      'Lead Time',
      'Stock Location',
      'Notes',
    ],
  ];

  let totalCost = 0;
  let totalFinal = 0;
  let selectedCount = 0;

  rfq.items.forEach((item, idx) => {
    const selectedQuotes = item.quotes.filter((q) => q.quote.isSelected && q.quote.costPricePerCaseUsd !== null);

    selectedQuotes.forEach((q) => {
      const quote = q.quote;
      const quantity = item.quantity || 1;
      const costPerCase = quote.costPricePerCaseUsd!;
      const finalPerCase = item.finalPriceUsd || costPerCase;

      const caseConfig = quote.caseConfig ? Number(quote.caseConfig) : (item.caseConfig || null);
      const costPerBottle = caseConfig ? costPerCase / caseConfig : null;
      const finalPerBottle = caseConfig ? finalPerCase / caseConfig : null;

      // For bottles request, calculate total based on bottles
      const isBottles = item.quantityUnit === 'bottles';
      const lineTotal = isBottles && costPerBottle
        ? finalPerBottle! * quantity
        : finalPerCase * quantity;

      totalCost += isBottles && costPerBottle
        ? costPerBottle * quantity
        : costPerCase * quantity;
      totalFinal += lineTotal;
      selectedCount++;

      // Determine effective values for alternatives
      const effectiveProduct = quote.quoteType === 'alternative'
        ? quote.alternativeProductName || item.productName
        : item.productName;
      const effectiveProducer = quote.quoteType === 'alternative'
        ? quote.alternativeProducer || item.producer
        : item.producer;
      const effectiveVintage = quote.quoteType === 'alternative'
        ? quote.alternativeVintage
        : quote.quotedVintage || item.vintage;
      const effectiveRegion = quote.quoteType === 'alternative'
        ? quote.alternativeRegion || item.region
        : item.region;
      const effectiveCountry = quote.quoteType === 'alternative'
        ? quote.alternativeCountry || item.country
        : item.country;
      const effectiveBottleSize = quote.quoteType === 'alternative'
        ? quote.alternativeBottleSize || quote.bottleSize || item.bottleSize
        : quote.bottleSize || item.bottleSize;
      const effectiveCaseConfig = quote.quoteType === 'alternative'
        ? quote.alternativeCaseConfig || quote.caseConfig || item.caseConfig
        : quote.caseConfig || item.caseConfig;
      const effectiveLwin = quote.quoteType === 'alternative'
        ? quote.alternativeLwin || item.lwin
        : item.lwin;

      selectedData.push([
        idx + 1,
        effectiveProduct || '',
        effectiveProducer || '',
        effectiveVintage || '',
        effectiveRegion || '',
        effectiveCountry || '',
        effectiveBottleSize || '',
        effectiveCaseConfig || '',
        effectiveLwin || '',
        quantity,
        item.quantityUnit || 'cases',
        q.partner.businessName,
        costPerCase,
        costPerBottle ? Number(costPerBottle.toFixed(2)) : '',
        finalPerCase,
        finalPerBottle ? Number(finalPerBottle.toFixed(2)) : '',
        Number(lineTotal.toFixed(2)),
        quote.leadTimeDays ? `${quote.leadTimeDays}` : '',
        quote.stockLocation || '',
        quote.notes || '',
      ]);
    });
  });

  // Totals
  selectedData.push([]);
  selectedData.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTALS',
    Number(totalCost.toFixed(2)),
    '',
    Number(totalFinal.toFixed(2)),
    '',
    Number(totalFinal.toFixed(2)),
    '',
    '',
    '',
  ]);

  const margin = totalFinal > 0 ? ((totalFinal - totalCost) / totalFinal) * 100 : 0;
  selectedData.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'MARGIN',
    '',
    '',
    `${margin.toFixed(1)}%`,
    '',
    '',
    '',
    '',
    '',
  ]);
  selectedData.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'ITEMS',
    selectedCount,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  const ws3 = XLSX.utils.aoa_to_sheet(selectedData);
  ws3['!cols'] = [
    { wch: 4 },  // #
    { wch: 30 }, // Product Name
    { wch: 15 }, // Producer
    { wch: 8 },  // Vintage
    { wch: 12 }, // Region
    { wch: 10 }, // Country
    { wch: 10 }, // Bottle Size
    { wch: 10 }, // Case Config
    { wch: 18 }, // LWIN
    { wch: 6 },  // Qty
    { wch: 8 },  // Unit
    { wch: 18 }, // Supplier
    { wch: 10 }, // Cost/Case
    { wch: 10 }, // Cost/Bottle
    { wch: 10 }, // Final/Case
    { wch: 10 }, // Final/Bottle
    { wch: 10 }, // Line Total
    { wch: 10 }, // Lead Time
    { wch: 15 }, // Stock Location
    { wch: 20 }, // Notes
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Selected');

  // =========================================================
  // Sheet 4: BY PARTNER (What each supplier needs to provide)
  // =========================================================
  const uniquePartners = Array.from(
    new Map(rfq.partners.map((p) => [p.partnerId, p])).values(),
  );

  const partnerData: (string | number | null)[][] = [
    ['BY PARTNER - SUPPLIER BREAKDOWN'],
    [`RFQ: ${rfq.rfqNumber}`],
    [],
  ];

  uniquePartners.forEach((partnerRecord) => {
    const partnerSelectedQuotes = rfq.items.flatMap((item) =>
      item.quotes
        .filter((q) => q.quote.partnerId === partnerRecord.partnerId && q.quote.isSelected && q.quote.costPricePerCaseUsd !== null)
        .map((q) => ({ item, quote: q })),
    );

    if (partnerSelectedQuotes.length === 0) return;

    partnerData.push([]);
    partnerData.push([`PARTNER: ${partnerRecord.partner.businessName}`]);
    partnerData.push([`Status: ${partnerRecord.status}`]);
    partnerData.push([`Notes: ${partnerRecord.partnerNotes || '-'}`]);
    partnerData.push([]);
    partnerData.push([
      '#',
      'Product',
      'Producer',
      'Vintage',
      'Qty',
      'Unit',
      'Price/Case',
      'Line Total',
      'Lead Time',
      'Location',
    ]);

    let partnerTotal = 0;
    partnerSelectedQuotes.forEach(({ item, quote: q }, idx) => {
      const quantity = item.quantity || 1;
      const pricePerCase = q.quote.costPricePerCaseUsd!;
      const isBottles = item.quantityUnit === 'bottles';
      const caseConfig = q.quote.caseConfig ? Number(q.quote.caseConfig) : null;
      const lineTotal = isBottles && caseConfig
        ? (pricePerCase / caseConfig) * quantity
        : pricePerCase * quantity;
      partnerTotal += lineTotal;

      const effectiveProduct = q.quote.quoteType === 'alternative'
        ? q.quote.alternativeProductName || item.productName
        : item.productName;
      const effectiveVintage = q.quote.quoteType === 'alternative'
        ? q.quote.alternativeVintage
        : q.quote.quotedVintage || item.vintage;

      partnerData.push([
        idx + 1,
        effectiveProduct || '',
        item.producer || '',
        effectiveVintage || '',
        quantity,
        item.quantityUnit || 'cases',
        pricePerCase,
        Number(lineTotal.toFixed(2)),
        q.quote.leadTimeDays || '',
        q.quote.stockLocation || '',
      ]);
    });

    partnerData.push([
      '',
      '',
      '',
      '',
      '',
      'PARTNER TOTAL',
      '',
      Number(partnerTotal.toFixed(2)),
      '',
      '',
    ]);
  });

  const ws4 = XLSX.utils.aoa_to_sheet(partnerData);
  ws4['!cols'] = [
    { wch: 4 },  // #
    { wch: 30 }, // Product
    { wch: 15 }, // Producer
    { wch: 10 }, // Vintage
    { wch: 6 },  // Qty
    { wch: 8 },  // Unit
    { wch: 10 }, // Price/Case
    { wch: 12 }, // Line Total
    { wch: 10 }, // Lead Time
    { wch: 15 }, // Location
  ];
  XLSX.utils.book_append_sheet(wb, ws4, 'By Partner');

  // =========================================================
  // Sheet 5: UNQUOTED ITEMS (No responses)
  // =========================================================
  const unquotedItems = rfq.items.filter(
    (item) => !item.quotes.some((q) => q.quote.costPricePerCaseUsd !== null),
  );

  const unquotedData: (string | number | null)[][] = [
    ['UNQUOTED ITEMS - NO RESPONSES'],
    [`RFQ: ${rfq.rfqNumber}`],
    [`Total unquoted: ${unquotedItems.length}`],
    [],
    [
      '#',
      'Product Name',
      'Producer',
      'Vintage',
      'Region',
      'Country',
      'Bottle Size',
      'Case Config',
      'LWIN',
      'Qty',
      'Unit',
      'N/A Reasons',
    ],
  ];

  unquotedItems.forEach((item, idx) => {
    // Collect N/A reasons from partners
    const naReasons = item.quotes
      .filter((q) => q.quote.quoteType === 'not_available' && q.quote.notAvailableReason)
      .map((q) => `${q.partner.businessName}: ${q.quote.notAvailableReason}`)
      .join('; ');

    unquotedData.push([
      idx + 1,
      item.productName || '',
      item.producer || '',
      item.vintage || '',
      item.region || '',
      item.country || '',
      item.bottleSize || '',
      item.caseConfig || '',
      item.lwin || '',
      item.quantity || '',
      item.quantityUnit || 'cases',
      naReasons || 'No responses',
    ]);
  });

  const ws5 = XLSX.utils.aoa_to_sheet(unquotedData);
  ws5['!cols'] = [
    { wch: 4 },  // #
    { wch: 30 }, // Product Name
    { wch: 15 }, // Producer
    { wch: 8 },  // Vintage
    { wch: 12 }, // Region
    { wch: 10 }, // Country
    { wch: 10 }, // Bottle Size
    { wch: 10 }, // Case Config
    { wch: 18 }, // LWIN
    { wch: 6 },  // Qty
    { wch: 8 },  // Unit
    { wch: 50 }, // N/A Reasons
  ];
  XLSX.utils.book_append_sheet(wb, ws5, 'Unquoted');

  // =========================================================
  // Generate and download
  // =========================================================
  const timestamp = new Date().toISOString().split('T')[0];
  const safeName = rfq.rfqNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `SOURCE_${safeName}_${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
};

export default exportRfqToExcel;
