import { Metadata } from 'next';
import { SearchParams, createLoader, parseAsJson } from 'nuqs/server';
import z from 'zod';

import ArticlesSection from '@/app/_website/articles/components/ArticlesSection';
import CallToActionSection from '@/app/_website/shared/components/CallToActionSection';
import Footer from '@/app/_website/shared/components/Footer';
import Header from '@/app/_website/shared/components/Header';

export const metadata: Metadata = {
  title: 'Artikelen',
  description: 'Artikelen over Easybooker',
};

const ArticlesPage = async ({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const searchParams = await searchParamsPromise;

  const { filter } = createLoader({
    filter: parseAsJson(z.string().optional().parse),
  })(searchParams);

  return (
    <main data-theme="light">
      <Header />
      <ArticlesSection filterSubject={filter ?? undefined} />
      <div>
        <CallToActionSection />
        <Footer />
      </div>
    </main>
  );
};

export default ArticlesPage;
