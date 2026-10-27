import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PCO Process Flow | Craft & Culture',
  description:
    'Guide to the Private Client Order process, from order creation to delivery.',
  robots: { index: false, follow: false },
};

const PcoFlowsLayout = ({ children }: React.PropsWithChildren) => {
  return <>{children}</>;
};

export default PcoFlowsLayout;
