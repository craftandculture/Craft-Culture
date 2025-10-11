import CompanyAdvantagesSection from '@/app/_website/home/components/CompanyAdvantagesSection';
import FeaturesSection from '@/app/_website/home/components/FeaturesSection/FeaturesSection';
import HomeHeroSection from '@/app/_website/home/components/HomeHeroSection/HomeHeroSection';
import HowItWorksSection from '@/app/_website/home/components/ProcessSection/HowItWorksSection';
import ServiceIntegrationsSection from '@/app/_website/home/components/ServiceIntegrationsSection';
import TestimonialsSection from '@/app/_website/home/components/TestimonialsSection/TestimonialsSection';
import WebsitePrivacySection from '@/app/_website/home/components/WebsitePrivacySection';
import PricingPlansSection from '@/app/_website/pricing/components/PricingSection/PricingPlansSection';
import CallToActionSection from '@/app/_website/shared/components/CallToActionSection';
import Footer from '@/app/_website/shared/components/Footer';
import Header from '@/app/_website/shared/components/Header';

export const revalidate = 43_200; // 12 hours

const HomePage = () => {
  return (
    <main data-theme="light">
      <Header />
      <HomeHeroSection />
      <FeaturesSection />
      <CompanyAdvantagesSection />
      <HowItWorksSection />
      <ServiceIntegrationsSection />
      <TestimonialsSection />
      <WebsitePrivacySection />
      <PricingPlansSection />
      <CallToActionSection />
      <Footer />
    </main>
  );
};

export default HomePage;
