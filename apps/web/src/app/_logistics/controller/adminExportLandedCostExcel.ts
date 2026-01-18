import ExcelJS from 'exceljs';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import adminGetLandedCostReport from './adminGetLandedCostReport';

const exportLandedCostSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  partnerId: z.string().uuid().optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),
});

/**
 * Export landed cost report as Excel file
 *
 * Returns base64-encoded Excel file data
 */
const adminExportLandedCostExcel = adminProcedure
  .input(exportLandedCostSchema)
  .mutation(async ({ input, ctx }) => {
    // Get the report data using the existing query logic
    const report = await adminGetLandedCostReport._def.query({
      input,
      ctx,
      type: 'query',
      path: 'logistics.admin.getLandedCostReport',
      rawInput: input,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Craft & Culture';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    summarySheet.addRows([
      { metric: 'Total Shipments', value: report.summary.totalShipments },
      { metric: 'Total Bottles', value: report.summary.totalBottles },
      { metric: 'Total Cases', value: report.summary.totalCases },
      { metric: 'Total Product Cost (USD)', value: report.summary.totalProductCost },
      { metric: 'Total Shipping Cost (USD)', value: report.summary.totalShippingCost },
      { metric: 'Total Landed Cost (USD)', value: report.summary.totalLandedCost },
      { metric: 'Average Cost Per Bottle (USD)', value: report.summary.averageCostPerBottle },
      { metric: '', value: '' },
      { metric: 'Cost Breakdown', value: '' },
      { metric: 'Freight', value: report.summary.costBreakdown.freight },
      { metric: 'Insurance', value: report.summary.costBreakdown.insurance },
      { metric: 'Handling', value: report.summary.costBreakdown.handling },
      { metric: 'Customs', value: report.summary.costBreakdown.customs },
      { metric: 'Government Fees', value: report.summary.costBreakdown.governmentFees },
      { metric: 'Delivery', value: report.summary.costBreakdown.delivery },
      { metric: 'Other', value: report.summary.costBreakdown.other },
    ]);

    // Style the header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Shipments Sheet
    const shipmentsSheet = workbook.addWorksheet('Shipments');
    shipmentsSheet.columns = [
      { header: 'Shipment #', key: 'shipmentNumber', width: 15 },
      { header: 'Type', key: 'shipmentType', width: 12 },
      { header: 'Transport', key: 'transportMode', width: 12 },
      { header: 'Route', key: 'route', width: 30 },
      { header: 'Partner', key: 'partner', width: 25 },
      { header: 'Delivered', key: 'deliveredAt', width: 12 },
      { header: 'Cases', key: 'cases', width: 10 },
      { header: 'Bottles', key: 'bottles', width: 10 },
      { header: 'Weight (kg)', key: 'weight', width: 12 },
      { header: 'Product Cost', key: 'productCost', width: 15 },
      { header: 'Freight', key: 'freight', width: 12 },
      { header: 'Insurance', key: 'insurance', width: 12 },
      { header: 'Handling', key: 'handling', width: 12 },
      { header: 'Customs', key: 'customs', width: 12 },
      { header: 'Gov Fees', key: 'govFees', width: 12 },
      { header: 'Delivery', key: 'delivery', width: 12 },
      { header: 'Other', key: 'other', width: 12 },
      { header: 'Total Shipping', key: 'totalShipping', width: 15 },
      { header: 'Total Landed', key: 'totalLanded', width: 15 },
      { header: 'Per Bottle', key: 'perBottle', width: 12 },
    ];

    for (const shipment of report.shipments) {
      shipmentsSheet.addRow({
        shipmentNumber: shipment.shipmentNumber,
        shipmentType: shipment.shipmentType,
        transportMode: shipment.transportMode,
        route: shipment.route,
        partner: shipment.partner,
        deliveredAt: shipment.deliveredAt
          ? new Date(shipment.deliveredAt).toLocaleDateString()
          : '',
        cases: shipment.cases,
        bottles: shipment.bottles,
        weight: shipment.weight,
        productCost: shipment.costs.product,
        freight: shipment.costs.freight,
        insurance: shipment.costs.insurance,
        handling: shipment.costs.handling,
        customs: shipment.costs.customs,
        govFees: shipment.costs.governmentFees,
        delivery: shipment.costs.delivery,
        other: shipment.costs.other,
        totalShipping: shipment.costs.totalShipping,
        totalLanded: shipment.costs.totalLanded,
        perBottle: shipment.costs.perBottle,
      });
    }

    shipmentsSheet.getRow(1).font = { bold: true };
    shipmentsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Products Sheet
    const productsSheet = workbook.addWorksheet('Products');
    productsSheet.columns = [
      { header: 'Product Name', key: 'productName', width: 40 },
      { header: 'SKU', key: 'productSku', width: 20 },
      { header: 'Total Bottles', key: 'totalBottles', width: 15 },
      { header: 'Total Cost (USD)', key: 'totalCost', width: 18 },
      { header: 'Avg Cost/Bottle', key: 'avgCostPerBottle', width: 18 },
      { header: 'Shipment Count', key: 'shipmentCount', width: 15 },
      { header: 'Avg Margin %', key: 'avgMarginPercentage', width: 15 },
    ];

    for (const product of report.products) {
      productsSheet.addRow({
        productName: product.productName,
        productSku: product.productSku || '',
        totalBottles: product.totalBottles,
        totalCost: product.totalCost,
        avgCostPerBottle: product.avgCostPerBottle,
        shipmentCount: product.shipmentCount,
        avgMarginPercentage: product.avgMarginPercentage,
      });
    }

    productsSheet.getRow(1).font = { bold: true };
    productsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Transport Mode Analysis Sheet
    const transportSheet = workbook.addWorksheet('By Transport Mode');
    transportSheet.columns = [
      { header: 'Transport Mode', key: 'mode', width: 20 },
      { header: 'Shipment Count', key: 'shipmentCount', width: 15 },
      { header: 'Total Cost (USD)', key: 'totalCost', width: 18 },
      { header: 'Total Bottles', key: 'totalBottles', width: 15 },
      { header: 'Avg Cost/Bottle', key: 'avgCostPerBottle', width: 18 },
    ];

    for (const [mode, data] of Object.entries(report.byTransportMode)) {
      transportSheet.addRow({
        mode: mode.replace('_', ' ').toUpperCase(),
        shipmentCount: data.shipmentCount,
        totalCost: data.totalCost,
        totalBottles: data.totalBottles,
        avgCostPerBottle: data.avgCostPerBottle,
      });
    }

    transportSheet.getRow(1).font = { bold: true };
    transportSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      data: base64,
      filename: `landed-cost-report-${new Date().toISOString().split('T')[0]}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  });

export default adminExportLandedCostExcel;
