import PricingCalculatorWizard from '@/app/_pricingCalculator/components/PricingCalculatorWizard';

/**
 * New pricing session page
 *
 * Wizard flow for creating a new pricing calculation session
 */
const NewPricingSessionPage = () => {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PricingCalculatorWizard />
    </main>
  );
};

export default NewPricingSessionPage;
