import { redirect } from 'next/navigation';

/**
 * Quote requests list
 *
 * Requests and the quotes they receive are one workflow, listed together on
 * the Freight quotes page; this address is kept so old links still land there.
 */
const QuoteRequestsListPage = () => {
  redirect('/platform/admin/logistics/quotes');
};

export default QuoteRequestsListPage;
