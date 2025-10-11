import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export const GET = (request: NextRequest) => {
  redirect(request.nextUrl.pathname + '/general');
};
