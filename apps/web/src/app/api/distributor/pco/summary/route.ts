import { eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import renderOrderSummaryPDF from '@/app/_privateClientOrders/utils/renderOrderSummaryPDF';
import db from '@/database/client';
import { partners, privateClientOrderItems, privateClientOrders } from '@/database/schema';

/**
 * Download a summary PDF for multiple distributor orders
 *
 * GET /api/distributor/pco/summary?orderIds=uuid1,uuid2,...
 *
 * Distributors can only access PDFs for orders assigned to them.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderIdsParam = searchParams.get('orderIds');

    if (!orderIdsParam) {
      return NextResponse.json({ error: 'orderIds is required' }, { status: 400 });
    }

    const orderIds = orderIdsParam.split(',').filter(Boolean);
    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'At least one order ID is required' }, { status: 400 });
    }

    // Fetch all orders
    const ordersResult = await db
      .select()
      .from(privateClientOrders)
      .where(inArray(privateClientOrders.id, orderIds));

    if (ordersResult.length === 0) {
      return NextResponse.json({ error: 'No orders found' }, { status: 404 });
    }

    // Verify all orders belong to the same distributor and user has access
    const distributorIds = new Set(ordersResult.map((o) => o.distributorId).filter(Boolean));
    if (distributorIds.size === 0) {
      return NextResponse.json({ error: 'Orders have no distributor assigned' }, { status: 400 });
    }

    // Verify user is a member of at least one of the distributors (or is admin)
    if (user.role !== 'admin') {
      let hasAccess = false;
      for (const distributorId of distributorIds) {
        if (!distributorId) continue;
        const membership = await db.query.partnerMembers.findFirst({
          where: {
            userId: user.id,
            partnerId: distributorId,
          },
        });
        if (membership) {
          hasAccess = true;
          break;
        }
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to these orders' }, { status: 403 });
      }
    }

    // Get the distributor name from the first order's distributor
    const firstDistributorId = ordersResult[0]?.distributorId;
    let distributorName = 'Distributor';
    if (firstDistributorId) {
      const [distributorResult] = await db
        .select({ businessName: partners.businessName })
        .from(partners)
        .where(eq(partners.id, firstDistributorId));
      if (distributorResult?.businessName) {
        distributorName = distributorResult.businessName;
      }
    }

    // Fetch line items for all orders in one query
    const allLineItems = await db
      .select()
      .from(privateClientOrderItems)
      .where(inArray(privateClientOrderItems.orderId, orderIds));

    // Group line items by order
    const lineItemsByOrder = new Map<string, typeof allLineItems>();
    for (const item of allLineItems) {
      const existing = lineItemsByOrder.get(item.orderId) ?? [];
      existing.push(item);
      lineItemsByOrder.set(item.orderId, existing);
    }

    // Build orders data for the PDF template
    const ordersData = ordersResult.map((order) => {
      const items = lineItemsByOrder.get(order.id) ?? [];
      const usdToAedRate = order.usdToAedRate ?? 3.6725;
      const totalSupplierCost = items.reduce((sum, item) => sum + item.totalUsd, 0);
      const orderTotal = order.totalUsd ?? 0;

      const calculateClientPrice = (supplierTotal: number) => {
        if (totalSupplierCost === 0) return 0;
        return (supplierTotal / totalSupplierCost) * orderTotal;
      };

      return {
        orderNumber: order.orderNumber ?? order.id,
        clientName: order.clientName ?? 'Client',
        clientPhone: order.clientPhone,
        createdAt: order.createdAt,
        totalUsd: orderTotal,
        usdToAedRate,
        lineItems: items.map((item) => {
          const clientTotal = calculateClientPrice(item.totalUsd);
          const clientPricePerCase = item.quantity > 0 ? clientTotal / item.quantity : 0;
          const distributorCostPerCase = item.pricePerCaseUsd / 0.97;

          return {
            productName: item.productName ?? 'Unknown Product',
            producer: item.producer,
            vintage: item.vintage,
            region: item.region,
            bottleSize: item.bottleSize,
            quantity: item.quantity ?? 0,
            distributorCostPerCaseUsd: distributorCostPerCase,
            pricePerCaseUsd: clientPricePerCase,
            totalUsd: clientTotal,
          };
        }),
      };
    });

    // Sort by order number
    ordersData.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

    const pdfBuffer = await renderOrderSummaryPDF({
      distributorName,
      orders: ordersData,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Order-Summary-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Summary PDF generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
