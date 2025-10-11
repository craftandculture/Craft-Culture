import React from 'react';

import Footer from '@/app/_website/shared/components/Footer';
import Header from '@/app/_website/shared/components/Header';
import Section from '@/app/_website/shared/components/Section';
import SectionContent from '@/app/_website/shared/components/SectionContent';

const Layout = async ({ children }: React.PropsWithChildren) => {
  return (
    <main>
      <Header />
      <Section>
        <SectionContent className="prose gap-0">
          <article className="prose-code:bg-fill-code prose-code:text-text-code prose prose-headings:font-heading prose-headings:font-medium prose-p:before:content-none prose-p:after:content-none prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none gap-0">
            {children}
          </article>
        </SectionContent>
      </Section>
      <Footer />
    </main>
  );
};

export default Layout;
