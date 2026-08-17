'use client';

import { IconArrowLeft, IconDeviceFloppy, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { QuoteFormState, QuoteLineDraft } from '../types';
import QuoteLinePicker from './QuoteLinePicker';
import QuoteLinesTable from './QuoteLinesTable';
import QuoteSettingsPanel from './QuoteSettingsPanel';
import SalesQuotesList from './SalesQuotesList';

/** Matches how the recent hand-built quotes were configured. */
const emptyForm = (): QuoteFormState => ({
  slug: '',
  quoteRef: '',
  client: '',
  clientCompany: '',
  contactName: '',
  contactEmail: '',
  eyebrow: 'Indicative Quotation',
  h1: 'Fine Wine Quotation',
  subtitle: '',
  validUntil: '',
  promoUntil: '',
  orderUnit: 'bottle',
  bottlesOnly: false,
  offered: true,
  stockStatus: true,
  pcLabel: 'Private Client',
  whLabel: 'UAE Warehouse',
  ibLabel: 'Inbound',
  priceBasis: 'In Bond, UAE',
  title: '',
  extraColLabel: '',
  extraColMultiplier: 1.18,
});

/**
 * Self-service quote builder.
 *
 * Lines are selected from the live catalogue (the same data behind
 * /price-list-beta) and rendered with the standard branded template, so a quote
 * built here is identical in look and pricing basis to the ones built by hand.
 *
 * Prices are snapshotted onto the quote when saved. That is deliberate: a quote
 * sent to a client must not silently reprice itself afterwards. Re-add a line
 * to pick up a new price.
 */
const QuoteBuilderClient = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<QuoteFormState>(emptyForm);
  const [lines, setLines] = useState<QuoteLineDraft[]>([]);

  const quotesQuery = useQuery(api.salesQuotes.admin.getMany.queryOptions({}));

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: api.salesQuotes.admin.getMany.queryKey({}),
    });

  const save = useMutation({
    ...api.salesQuotes.admin.save.mutationOptions(),
    onSuccess: (saved) => {
      toast.success('Quote saved');
      setForm((current) => ({ ...current, id: saved.id }));
      void invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    ...api.salesQuotes.admin.setStatus.mutationOptions(),
    onSuccess: (updated) => {
      toast.success(
        updated.status === 'published' ? 'Quote published' : 'Quote unpublished',
      );
      void invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    ...api.salesQuotes.admin.delete.mutationOptions(),
    onSuccess: () => {
      toast.success('Quote deleted');
      void invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const openQuote = async (id: string) => {
    const quote = await queryClient.fetchQuery(
      api.salesQuotes.admin.getOne.queryOptions({ id }),
    );

    if (!quote) return;

    const options = quote.options ?? {};
    setForm({
      id: quote.id,
      slug: quote.slug,
      quoteRef: quote.quoteRef,
      client: quote.client,
      clientCompany: quote.clientCompany ?? '',
      contactName: quote.contactName ?? '',
      contactEmail: quote.contactEmail ?? '',
      eyebrow: quote.eyebrow,
      h1: quote.h1,
      subtitle: quote.subtitle ?? '',
      validUntil: quote.validUntil ?? '',
      promoUntil: quote.promoUntil ?? '',
      orderUnit: options.orderUnit ?? 'bottle',
      bottlesOnly: !!options.bottlesOnly,
      offered: !!options.offered,
      stockStatus: !!options.stockStatus,
      pcLabel: options.pcLabel ?? 'Private Client',
      whLabel: options.whLabel ?? 'UAE Warehouse',
      ibLabel: options.ibLabel ?? 'Inbound',
      priceBasis: options.priceBasis ?? 'In Bond, UAE',
      title: options.title ?? '',
      extraColLabel: options.extraCol?.label ?? '',
      extraColMultiplier: options.extraCol?.multiplier ?? 1.18,
    });
    setLines(quote.lines as QuoteLineDraft[]);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!form.client.trim() || !form.quoteRef.trim() || !form.slug.trim()) {
      toast.error('Client, quote ref and slug are all required');
      return;
    }

    if (!lines.length) {
      toast.error('Add at least one line');
      return;
    }

    // sections keep the order they first appear in, so the builder's ordering
    // is what the client sees
    const regionOrder = [...new Set(lines.map((line) => line.region))];

    save.mutate({
      id: form.id,
      slug: form.slug,
      quoteRef: form.quoteRef,
      client: form.client,
      clientCompany: form.clientCompany || undefined,
      contactName: form.contactName || undefined,
      contactEmail: form.contactEmail || undefined,
      eyebrow: form.eyebrow,
      h1: form.h1,
      subtitle: form.subtitle || undefined,
      validUntil: form.validUntil || undefined,
      promoUntil: form.promoUntil || undefined,
      lines,
      options: {
        orderUnit: form.orderUnit,
        bottlesOnly: form.bottlesOnly,
        offered: form.offered,
        stockStatus: form.stockStatus,
        pcLabel: form.pcLabel,
        whLabel: form.whLabel,
        ibLabel: form.ibLabel,
        priceBasis: form.priceBasis,
        title: form.title || undefined,
        extraCol: form.extraColLabel.trim()
          ? {
              label: form.extraColLabel.trim(),
              multiplier: form.extraColMultiplier || 1,
            }
          : undefined,
        regionOrder,
      },
    });
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/q/${slug}`;
    void navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  const chosen = useMemo(
    () => new Set(lines.map((line) => line.lwin18)),
    [lines],
  );

  const totals = useMemo(() => {
    const bottles = lines.reduce((sum, line) => sum + (line.avail || 0), 0);
    const usd = lines.reduce(
      (sum, line) => sum + (line.qty || 0) * (line.busd || 0),
      0,
    );
    return { bottles, usd };
  }, [lines]);

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p>
              {quotesQuery.data?.length ?? 0} quote
              {quotesQuery.data?.length === 1 ? '' : 's'}
            </p>
          </Typography>
          <Button
            colorRole="brand"
            onClick={() => {
              setForm(emptyForm());
              setLines([]);
              setIsEditing(true);
            }}
          >
            <IconPlus className="mr-1 size-4" />
            New quote
          </Button>
        </div>

        <SalesQuotesList
          quotes={quotesQuery.data ?? []}
          isBusy={setStatus.isPending || remove.isPending}
          onEdit={(id) => void openQuote(id)}
          onSetStatus={(id, status) => setStatus.mutate({ id, status })}
          onDelete={(id) => remove.mutate({ id })}
          onCopyLink={copyLink}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          colorRole="muted"
          variant="ghost"
          onClick={() => setIsEditing(false)}
        >
          <IconArrowLeft className="mr-1 size-4" />
          All quotes
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <span>
              {lines.length} lines · {totals.bottles} btl offered ·{' '}
              ${Math.round(totals.usd).toLocaleString()} pre-filled
            </span>
          </Typography>

          {form.id ? (
            <Button colorRole="muted" variant="outline" asChild>
              <a
                href={`/q/${form.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview
              </a>
            </Button>
          ) : null}

          <Button
            colorRole="brand"
            isDisabled={save.isPending}
            onClick={handleSave}
          >
            <IconDeviceFloppy className="mr-1 size-4" />
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <Typography variant="bodySm" asChild>
              <p className="font-semibold">Quote details</p>
            </Typography>
            <QuoteSettingsPanel
              form={form}
              onChange={(patch) =>
                setForm((current) => ({ ...current, ...patch }))
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <Typography variant="bodySm" asChild>
              <p className="font-semibold">Add lines</p>
            </Typography>
            <QuoteLinePicker
              chosen={chosen}
              onAdd={(line) => setLines((current) => [...current, line])}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <Typography variant="bodySm" asChild>
            <p className="font-semibold">Lines on this quote</p>
          </Typography>
          <QuoteLinesTable
            lines={lines}
            onChange={(index, patch) =>
              setLines((current) =>
                current.map((line, i) =>
                  i === index ? { ...line, ...patch } : line,
                ),
              )
            }
            onRemove={(index) =>
              setLines((current) => current.filter((_, i) => i !== index))
            }
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteBuilderClient;
