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
      className={`bg-background-primary rounded-xl border px-4 py-4 dark:bg-white/[0.045] dark:shadow-none shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.04)] sm:px-6 sm:py-5 ${
        isNew ? 'border-emerald-400 ring-1 ring-emerald-400/30 dark:border-emerald-700' : 'border-black/[0.08] dark:border-white/10'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <UpdateTypeTag type={type} />
        {isNew && (
          <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-white uppercase">
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
