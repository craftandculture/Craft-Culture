import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export const GET = (request: NextRequest) => {
  const search = request.nextUrl.searchParams.toString();
  redirect(
    request.nextUrl.pathname +
      '/incoming-documents' +
      (search ? '?' + search : ''),
  );
};
