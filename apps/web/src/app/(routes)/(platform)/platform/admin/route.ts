import { redirect } from 'next/navigation';

export const GET = () => {
  return redirect('/platform/admin/pricing-models');
};
