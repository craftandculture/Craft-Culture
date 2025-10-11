import { NextRequest, NextResponse } from 'next/server';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import getUserOrganizations from '@/app/_organizations/data/getUserOrganizations';
import createClient from '@/lib/moneybird/client';
import serverConfig from '@/server.config';

export const GET = async (request: NextRequest) => {
  const organizationSlug = request.nextUrl.pathname.split('/')[1];
  const invoiceId = request.nextUrl.pathname.split('/').pop();

  const user = await getUserOrRedirect();
  const organizations = await getUserOrganizations(user.id);

  const organization = organizations.find(
    (org) => org.organizations.slug === organizationSlug,
  );

  if (!organization) {
    return NextResponse.json(
      { error: 'Organization not found' },
      { status: 404 },
    );
  }

  const moneybird = createClient({
    apiKey: serverConfig.moneybirdApiKey,
    administrationId: serverConfig.moneybirdAdministrationId,
  });

  const invoices = await moneybird.salesInvoices.getSalesInvoices({
    contactId: organization.organizations.externalContactId,
    state: ['open', 'pending_payment', 'late', 'reminded', 'paid'],
  });

  const invoice = invoices.find((invoice) => invoice.id === invoiceId);

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const fileBlob = await moneybird.salesInvoices.downloadPdf(invoice.id);

  const headers = new Headers();
  headers.append(
    'Content-Disposition',
    `attachment; filename="${invoice.invoice_id}.pdf"`,
  );
  headers.append('Content-Type', 'application/pdf');

  return new NextResponse(fileBlob, {
    headers,
  });
};
