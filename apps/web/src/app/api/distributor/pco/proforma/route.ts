import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import renderProformaInvoicePDF from '@/app/_privateClientOrders/utils/renderProformaInvoicePDF';
import db from '@/database/client';
import { partners, privateClientOrderItems } from '@/database/schema';

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

    // Allow if user is admin OR is a member of the distributor
    if (user.role !== 'admin' && !membership) {
      return NextResponse.json({ error: 'You do not have access to this order' }, { status: 403 });
    }

    // Fetch line items
    const lineItems = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, order.id));

    // Fetch partner details if available
    let partner: { businessName: string; businessEmail: string | null; businessPhone: string | null } | null = null;
    if (order.partnerId) {
      const [partnerResult] = await db
        .select({
          businessName: partners.businessName,
          businessEmail: partners.businessEmail,
          businessPhone: partners.businessPhone,
        })
        .from(partners)
        .where(eq(partners.id, order.partnerId));
      partner = partnerResult ?? null;
    }

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

    // Calculate total supplier cost for prorating client prices
    const totalSupplierCost = lineItems.reduce((sum, item) => sum + item.totalUsd, 0);
    const orderTotal = order.totalUsd ?? 0;

    // Helper to calculate client-facing price by prorating order total
    const calculateClientPrice = (supplierTotal: number) => {
      if (totalSupplierCost === 0) return 0;
      return (supplierTotal / totalSupplierCost) * orderTotal;
    };

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
      lineItems: lineItems.map((item) => {
        const clientTotal = calculateClientPrice(item.totalUsd);
        const clientPricePerCase = item.quantity > 0 ? clientTotal / item.quantity : 0;
        // Distributor cost = supplier price / 0.97 (C&C margin + transfer)
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
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
