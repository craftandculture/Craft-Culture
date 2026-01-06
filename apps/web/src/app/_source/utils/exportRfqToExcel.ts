import * as XLSX from 'xlsx';

interface RfqItem {
  id: string;
  productName: string | null;
  producer?: string | null;
  vintage?: string | null;
  region?: string | null;
  bottleSize?: string | null;
  caseConfig?: number | null;
  quantity?: number | null;
  selectedQuoteId?: string | null;
  finalPriceUsd?: number | null;
  quotes: Array<{
    quote: {
      id: string;
      partnerId: string;
      costPricePerCaseUsd: number;
      quoteType: string;
      alternativeProductName?: string | null;
      leadTimeDays?: number | null;
      stockLocation?: string | null;
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
  items: RfqItem[];
  partners: RfqPartner[];
}

/**
 * Export RFQ comparison matrix to Excel
 *
 * Creates a workbook with:
 * - Sheet 1: Comparison matrix (all partners side-by-side)
 * - Sheet 2: Selected quotes summary
 *
 * @example
 *   exportRfqToExcel(rfqData);
 *
 * @param rfq - The RFQ data with items, quotes, and partners
 */
const exportRfqToExcel = (rfq: RfqData) => {
  const wb = XLSX.utils.book_new();

  // Get unique partners from the RFQ
  const uniquePartners = Array.from(
    new Map(rfq.partners.map((p) => [p.partnerId, p.partner])).values(),
  );

  // Sheet 1: Comparison Matrix
  const comparisonData: (string | number)[][] = [
    ['SOURCE RFQ Comparison Matrix'],
    [`RFQ: ${rfq.rfqNumber} - ${rfq.name}`],
    [`Status: ${rfq.status}`],
    [],
    // Header row
    [
      'Product',
      'Producer',
      'Vintage',
      'Region',
      'Qty',
      ...uniquePartners.map((p) => p.businessName),
      'Selected',
      'Final Price',
    ],
  ];

  // Add item rows
  for (const item of rfq.items) {
    const row: (string | number)[] = [
      item.productName || '',
      item.producer || '',
      item.vintage || '',
      item.region || '',
      item.quantity || 0,
    ];

    // Add quote prices for each partner
    for (const partner of uniquePartners) {
      const quote = item.quotes.find((q) => q.quote.partnerId === partner.id);
      if (quote) {
        let cellValue = `$${quote.quote.costPricePerCaseUsd.toFixed(2)}`;
        if (quote.quote.quoteType === 'alternative') {
          cellValue += ` (Alt: ${quote.quote.alternativeProductName || 'alternative'})`;
        }
        if (quote.quote.leadTimeDays) {
          cellValue += ` [${quote.quote.leadTimeDays}d]`;
        }
        row.push(cellValue);
      } else {
        row.push('-');
      }
    }

    // Selected quote info
    const selectedQuote = item.quotes.find((q) => q.quote.isSelected);
    if (selectedQuote) {
      row.push(selectedQuote.partner.businessName);
      row.push(item.finalPriceUsd || selectedQuote.quote.costPricePerCaseUsd);
    } else {
      row.push('');
      row.push('');
    }

    comparisonData.push(row);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(comparisonData);

  // Set column widths
  ws1['!cols'] = [
    { wch: 35 }, // Product
    { wch: 20 }, // Producer
    { wch: 10 }, // Vintage
    { wch: 15 }, // Region
    { wch: 8 }, // Qty
    ...uniquePartners.map(() => ({ wch: 22 })), // Partner columns
    { wch: 15 }, // Selected
    { wch: 12 }, // Final Price
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Comparison');

  // Sheet 2: Selected Quotes Summary
  const selectedData: (string | number)[][] = [
    ['Selected Quotes Summary'],
    [`RFQ: ${rfq.rfqNumber}`],
    rfq.distributorCompany ? [`Customer: ${rfq.distributorCompany}`] : [],
    [],
    [
      'Product',
      'Producer',
      'Vintage',
      'Qty',
      'Supplier',
      'Cost/Case',
      'Final/Case',
      'Line Total',
      'Lead Time',
    ],
  ].filter((row) => row.length > 0);

  let totalCost = 0;
  let totalFinal = 0;

  for (const item of rfq.items) {
    const selectedQuote = item.quotes.find((q) => q.quote.isSelected);
    if (selectedQuote) {
      const quantity = item.quantity || 1;
      const costPerCase = selectedQuote.quote.costPricePerCaseUsd;
      const finalPerCase = item.finalPriceUsd || costPerCase;
      const lineTotal = finalPerCase * quantity;

      totalCost += costPerCase * quantity;
      totalFinal += lineTotal;

      selectedData.push([
        selectedQuote.quote.quoteType === 'alternative'
          ? selectedQuote.quote.alternativeProductName || item.productName || ''
          : item.productName || '',
        item.producer || '',
        item.vintage || '',
        quantity,
        selectedQuote.partner.businessName,
        costPerCase,
        finalPerCase,
        lineTotal,
        selectedQuote.quote.leadTimeDays ? `${selectedQuote.quote.leadTimeDays} days` : '-',
      ]);
    }
  }

  // Add totals row
  selectedData.push([]);
  selectedData.push([
    '',
    '',
    '',
    '',
    'TOTALS',
    totalCost,
    totalFinal,
    totalFinal,
    '',
  ]);

  // Add margin calculation
  const margin = totalFinal > 0 ? ((totalFinal - totalCost) / totalFinal) * 100 : 0;
  selectedData.push(['', '', '', '', 'Margin', '', '', `${margin.toFixed(1)}%`, '']);

  const ws2 = XLSX.utils.aoa_to_sheet(selectedData);

  // Set column widths for sheet 2
  ws2['!cols'] = [
    { wch: 35 }, // Product
    { wch: 20 }, // Producer
    { wch: 10 }, // Vintage
    { wch: 8 }, // Qty
    { wch: 18 }, // Supplier
    { wch: 12 }, // Cost/Case
    { wch: 12 }, // Final/Case
    { wch: 12 }, // Line Total
    { wch: 12 }, // Lead Time
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'Selected');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const safeName = rfq.rfqNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `SOURCE_${safeName}_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};

export default exportRfqToExcel;
