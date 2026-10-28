import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

import UpdateTypeTag from './UpdateTypeTag';
import type { ProductUpdateType } from '../types';
import linkLabelFor from '../utils/linkLabelFor';

export interface UpdateCardProps {
  type: ProductUpdateType;
  title: string;
  body: string;
  linkPath: string | null;
  isNew?: boolean;
  /** Text to highlight, from the search box */
  highlight?: string;
  /** In a staff preview the button is shown but goes nowhere */
  preview?: boolean;
}

/**
 * Wrap the parts of a string that match the search in a highlight
 *
 * @param text - The text to show
 * @param query - What the member searched for
 */
const highlighted = (text: string, query?: string) => {
  const q = query?.trim();
  if (!q) return text;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.split(new RegExp(`(${escaped})`, 'ig')).map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-amber-100 px-0.5 text-inherit dark:bg-amber-500/25">
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

/** One update on the What's New timeline */
const UpdateCard = ({ type, title, body, linkPath, isNew, highlight, preview }: UpdateCardProps) => {
  const label = linkLabelFor(linkPath);

  return (
    <article
      className="bg-surface-primary rounded-xl border border-black/[0.08] px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.04)] sm:px-6 sm:py-5 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <UpdateTypeTag type={type} />
        {/* Unseen updates alone carry a mark: a green dot and the word, never a solid pill */}
        {isNew && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            New
          </span>
        )}
      </div>
      <h3 className="text-text-primary text-base font-semibold text-balance sm:text-lg">
        {highlighted(title, highlight)}
      </h3>
      {body && (
        <p className="text-text-muted mt-1 max-w-2xl text-sm leading-relaxed">{highlighted(body, highlight)}</p>
      )}
      {label && linkPath && (
        <Link
          href={preview ? '#' : linkPath}
          onClick={preview ? (e) => e.preventDefault() : undefined}
          className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300"
        >
          {label}
          <IconArrowRight size={15} />
        </Link>
      )}
    </article>
  );
};

export default UpdateCard;
