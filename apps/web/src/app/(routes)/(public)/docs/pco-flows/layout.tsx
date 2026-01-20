import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PCO Process Flow | Craft & Culture',
  description:
    'Complete guide to Private Client Orders (PCO) process flow - from order creation to delivery. Understand the end-to-end process for wine partners, distributors, admins, and clients.',
};

const PcoFlowsLayout = ({ children }: React.PropsWithChildren) => {
  return <>{children}</>;
};

export default PcoFlowsLayout;
