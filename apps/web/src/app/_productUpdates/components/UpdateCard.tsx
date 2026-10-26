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
      className={`bg-background-primary rounded-xl border px-4 py-4 sm:px-5 ${
        isNew ? 'border-emerald-300 dark:border-emerald-800' : 'border-border-muted'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <UpdateTypeTag type={type} />
        {isNew && (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:bg-emerald-500/10 dark:text-emerald-300">
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
          className="border-border-muted text-text-primary hover:bg-fill-muted mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold"
        >
          {label}
          <IconArrowRight size={14} />
        </Link>
      )}
    </article>
  );
};

export default UpdateCard;
