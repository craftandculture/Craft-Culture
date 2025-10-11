import MDX from '@/app/_ui/components/MDX/MDX';
import Footer from '@/app/_website/shared/components/Footer';
import Header from '@/app/_website/shared/components/Header';
import Section from '@/app/_website/shared/components/Section';
import SectionContent from '@/app/_website/shared/components/SectionContent';
import loadMarkdown from '@/lib/markdown/loadMarkdown';

const TermsPage = async () => {
  return (
    <main>
      <Header />
      <Section>
        <SectionContent className="prose gap-0">
          <MDX
            source={(await loadMarkdown('src/markdown/terms.mdx')).content}
          />
        </SectionContent>
      </Section>
      <Footer />
    </main>
  );
};

export default TermsPage;
