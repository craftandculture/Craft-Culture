import { Metadata } from 'next';

import ArticleContentSection from '@/app/_website/articles/components/ArticleContentSection';
import ArticleHeroSection from '@/app/_website/articles/components/ArticleHeroSection';
import getAllPosts from '@/app/_website/articles/data/getAllPosts';
import getPost from '@/app/_website/articles/data/getPost';
import CallToActionSection from '@/app/_website/shared/components/CallToActionSection';
import Footer from '@/app/_website/shared/components/Footer';
import Header from '@/app/_website/shared/components/Header';
import clientConfig from '@/client.config';

export const revalidate = 43_200; // 12 hours

type Props = {
  params: Promise<{ slug: string }>;
};

export const generateStaticParams = async () => {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const { slug } = await params;

  const post = await getPost(`${slug}.mdx`);

  return {
    title: post.meta.title,
    description: post.meta.description,
    openGraph: {
      type: 'article',
      title: `${post.meta.title}`,
      description: post.meta.description,
      images: {
        url: `${clientConfig.appUrl.origin}/_next/image?url=${encodeURIComponent(post.meta.image)}&w=1200&q=75`,
        width: 1200,
        alt: post.meta.title,
      },
      publishedTime: post.meta.date.toISOString(),
      url: new URL(post.slug, clientConfig.appUrl.origin),
      authors: [post.meta.author],
    },
  };
};

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;

  const post = await getPost(`${slug}.mdx`);

  return (
    <main data-theme="light">
      <Header />
      <ArticleHeroSection {...post.meta} />
      <ArticleContentSection content={post.content} />
      <CallToActionSection />
      <Footer />
    </main>
  );
};

export default Page;
