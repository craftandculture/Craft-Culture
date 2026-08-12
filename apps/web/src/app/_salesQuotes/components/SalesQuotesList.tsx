'use client';

import {
  IconCopy,
  IconExternalLink,
  IconPencil,
  IconTrash,
  IconWorld,
  IconWorldOff,
} from '@tabler/icons-react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface SalesQuoteRow {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  quoteRef: string;
  client: string;
  clientCompany: string | null;
  validUntil: string | null;
  totalBottles: number;
  totalUsd: number;
  updatedAt: Date | string;
}

export interface SalesQuotesListProps {
  quotes: SalesQuoteRow[];
  isBusy: boolean;
  onEdit: (id: string) => void;
  onSetStatus: (id: string, status: 'draft' | 'published') => void;
  onDelete: (id: string) => void;
  onCopyLink: (slug: string) => void;
}

const STATUS_COLOR = {
  published: 'success',
  draft: 'muted',
  archived: 'muted',
} as const;

/**
 * Every quote the team has built, newest edit first.
 *
 * Published rows carry a live link; drafts do not, because an unpublished slug
 * 404s for anyone who is not a signed-in admin.
 */
const SalesQuotesList = ({
  quotes,
  isBusy,
  onEdit,
  onSetStatus,
  onDelete,
  onCopyLink,
}: SalesQuotesListProps) => {
  if (!quotes.length) {
    return (
      <div className="rounded-lg border border-dashed border-border-muted px-4 py-12 text-center">
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p>No quotes yet. Create one to get started.</p>
        </Typography>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-muted rounded-lg border border-border-muted">
      {quotes.map((quote) => {
        const isPublished = quote.status === 'published';

        return (
          <div
            key={quote.id}
            className="flex flex-wrap items-center gap-3 px-3 py-3"
          >
            <Badge colorRole={STATUS_COLOR[quote.status]}>
              {quote.status}
            </Badge>

            <div className="min-w-48 flex-1">
              <Typography variant="bodySm" asChild>
                <p className="truncate">
                  {quote.client}
                  {quote.clientCompany ? (
                    <span className="text-text-muted">
                      {' '}
                      · {quote.clientCompany}
                    </span>
                  ) : null}
                </p>
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p className="truncate">
                  {quote.quoteRef} · /q/{quote.slug} · {quote.totalBottles} btl ·
                  ${quote.totalUsd.toLocaleString()}
                  {quote.validUntil ? ` · valid to ${quote.validUntil}` : ''}
                </p>
              </Typography>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                colorRole="muted"
                variant="outline"
                onClick={() => onEdit(quote.id)}
              >
                <IconPencil className="mr-1 size-3.5" />
                Edit
              </Button>

              <Button
                size="sm"
                colorRole="muted"
                variant="ghost"
                onClick={() => onCopyLink(quote.slug)}
                aria-label="Copy link"
              >
                <IconCopy className="size-3.5" />
              </Button>

              <Button size="sm" colorRole="muted" variant="ghost" asChild>
                <a
                  href={`/q/${quote.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open quote"
                >
                  <IconExternalLink className="size-3.5" />
                </a>
              </Button>

              <Button
                size="sm"
                colorRole={isPublished ? 'muted' : 'brand'}
                variant={isPublished ? 'outline' : 'default'}
                isDisabled={isBusy}
                onClick={() =>
                  onSetStatus(quote.id, isPublished ? 'draft' : 'published')
                }
              >
                {isPublished ? (
                  <>
                    <IconWorldOff className="mr-1 size-3.5" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <IconWorld className="mr-1 size-3.5" />
                    Publish
                  </>
                )}
              </Button>

              {!isPublished ? (
                <Button
                  size="sm"
                  colorRole="danger"
                  variant="ghost"
                  isDisabled={isBusy}
                  onClick={() => onDelete(quote.id)}
                  aria-label="Delete quote"
                >
                  <IconTrash className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SalesQuotesList;
