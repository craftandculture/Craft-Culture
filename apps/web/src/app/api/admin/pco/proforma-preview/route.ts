import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import renderProformaInvoicePDF from '@/app/_privateClientOrders/utils/renderProformaInvoicePDF';
import db from '@/database/client';
import { partners, privateClientOrderItems } from '@/database/schema';

/**
 * Preview proforma invoice PDF for an order
 *
 * GET /api/admin/pco/proforma-preview?orderId={uuid}
 * GET /api/admin/pco/proforma-preview?orderNumber={orderNumber}
 *
 * Returns the PDF directly for viewing in browser or download.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin user
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get orderId or orderNumber from query params
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const orderNumber = searchParams.get('orderNumber');

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'orderId or orderNumber is required' }, { status: 400 });
    }

    // Fetch the order by ID or order number
    const order = await db.query.privateClientOrders.findFirst({
      where: orderId ? { id: orderId } : { orderNumber: orderNumber! },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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

    // Fetch distributor details if available
    let distributor: { businessName: string } = { businessName: 'Distributor' };
    if (order.distributorId) {
      const [distributorResult] = await db
        .select({
          businessName: partners.businessName,
        })
        .from(partners)
        .where(eq(partners.id, order.distributorId));
      if (distributorResult?.businessName) {
        distributor = { businessName: distributorResult.businessName };
      }
    }

    // Generate PDF
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
        subtotalUsd: order.subtotalUsd,
        dutyUsd: order.dutyUsd,
        vatUsd: order.vatUsd,
        logisticsUsd: order.logisticsUsd,
        totalUsd: order.totalUsd ?? 0,
      },
      lineItems: lineItems.map((item) => ({
        productName: item.productName ?? 'Unknown Product',
        producer: item.producer,
        vintage: item.vintage,
        region: item.region,
        bottleSize: item.bottleSize,
        quantity: item.quantity ?? 0,
        pricePerCaseUsd: item.pricePerCaseUsd,
        totalUsd: item.totalUsd,
      })),
      partner,
      distributor,
    });

    // Return PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Proforma-Invoice-${order.orderNumber ?? order.id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('PDF preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
