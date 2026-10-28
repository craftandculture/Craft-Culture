import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import distributorItemView from '@/app/_privateClientOrders/utils/distributorItemView';
import getCraftCulturePartnerId from '@/app/_privateClientOrders/utils/getCraftCulturePartnerId';
import renderProformaInvoicePDF from '@/app/_privateClientOrders/utils/renderProformaInvoicePDF';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import { partners, privateClientOrderItems } from '@/database/schema';
import logger from '@/utils/logger';

/**
 * Download proforma invoice PDF for a distributor's order
 *
 * GET /api/distributor/pco/proforma?orderId={uuid}
 *
 * Distributors can only access PDFs for orders assigned to them.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is logged in
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get orderId from query params
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Fetch the order
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify user is a member of the distributor this order is assigned to
    if (!order.distributorId) {
      return NextResponse.json({ error: 'Order has no distributor assigned' }, { status: 400 });
    }

    const membership = await db.query.partnerMembers.findFirst({
      where: {
        userId: user.id,
        partnerId: order.distributorId,
      },
    });

    // Allow C&C staff, or a member of the distributor
    if (!isTeamMember(user) && !membership) {
      return NextResponse.json({ error: 'You do not have access to this order' }, { status: 403 });
    }

    // Fetch line items
    const lineItems = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, order.id));

    /*
      The wine partner is never named to the distributor, on the order page or
      here. C&C's own orders (Private Cellar deliveries) may say they are C&C's.
    */
    const partner: { businessName: string } | null =
      order.partnerId && order.partnerId === (await getCraftCulturePartnerId())
        ? { businessName: 'Craft & Culture' }
        : null;

    // Fetch distributor details
    let distributor: { businessName: string } = { businessName: 'Distributor' };
    const [distributorResult] = await db
      .select({
        businessName: partners.businessName,
      })
      .from(partners)
      .where(eq(partners.id, order.distributorId));
    if (distributorResult?.businessName) {
      distributor = { businessName: distributorResult.businessName };
    }

    // Get USD to AED exchange rate (default to 3.6725 if not set)
    const usdToAedRate = order.usdToAedRate ?? 3.6725;

    // Each line's share of the distributor cost and client price, never the partner's price
    const orderTotal = order.totalUsd ?? 0;
    const visibleItems = distributorItemView(lineItems, order);

    // Generate PDF with client-facing prices
    const pdfBuffer = await renderProformaInvoicePDF({
      order: {
        orderNumber: order.orderNumber ?? order.id,
        createdAt: order.createdAt,
        paymentReference: order.paymentReference,
        clientName: order.clientName ?? 'Client',
        clientEmail: order.clientEmail,
        clientPhone: order.clientPhone,
        clientAddress: order.clientAddress,
        deliveryNotes: order.deliveryNotes,
        // For proforma, show the total as the subtotal since line items are client-facing
        subtotalUsd: orderTotal,
        dutyUsd: 0, // Included in prorated line items
        vatUsd: 0, // Included in prorated line items
        logisticsUsd: 0, // Included in prorated line items
        totalUsd: orderTotal,
        usdToAedRate,
      },
      lineItems: visibleItems.map((item) => ({
        productName: item.productName ?? 'Unknown Product',
        producer: item.producer,
        vintage: item.vintage,
        region: item.region,
        bottleSize: item.bottleSize,
        caseConfig: item.caseConfig,
        quantity: item.quantity ?? 0,
        distributorCostPerCaseUsd: item.distributorCostPerCaseUsd,
        pricePerCaseUsd: item.clientPricePerCaseUsd,
        totalUsd: item.clientTotalUsd,
        inBox: item.inBox,
      })),
      partner,
      distributor,
    });

    // Return PDF with appropriate headers for download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Proforma-Invoice-${order.orderNumber ?? order.id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error('PDF generation error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
