import { MDXRemote } from 'next-mdx-remote/rsc';
import { twMerge } from 'tailwind-merge';

export interface MDXProps {
  source: string;
  className?: string;
}

const MDX = ({ source, className }: MDXProps) => {
  return (
    <article
      className={twMerge(
        'prose-code:bg-fill-code prose-code:text-text-code prose prose-headings:font-heading prose-headings:font-medium prose-p:before:content-none prose-p:after:content-none prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none gap-0',
        className,
      )}
    >
      <MDXRemote
        source={source}
        options={{
          parseFrontmatter: true,
        }}
      />
    </article>
  );
};

export default MDX;
