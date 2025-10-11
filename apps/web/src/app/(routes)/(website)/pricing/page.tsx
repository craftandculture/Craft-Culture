import ChiefExecutiveMessageSection from '@/app/_website/pricing/components/ChiefExecutiveMessageSection';
import FrequentlyAskedQuestionsSection from '@/app/_website/pricing/components/FrequentlyAskedQuestionsSection/FrequentlyAskedQuestionsSection';
import PricingHeroSection from '@/app/_website/pricing/components/PricingHeroSection';
import CallToActionSection from '@/app/_website/shared/components/CallToActionSection';
import Footer from '@/app/_website/shared/components/Footer';
import Header from '@/app/_website/shared/components/Header';

const PricingPage = () => {
  return (
    <main data-theme="light">
      <Header />
      <PricingHeroSection />
      {/* <EstimatePriceSection /> */}
      <ChiefExecutiveMessageSection />
      <FrequentlyAskedQuestionsSection />
      <div>
        <CallToActionSection />
        <Footer />
      </div>
    </main>
  );
};

export default PricingPage;
