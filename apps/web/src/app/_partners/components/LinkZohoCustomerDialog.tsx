'use client';

import { IconBuildingStore, IconSearch } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface LinkZohoCustomerDialogProps {
  partnerId: string;
  partnerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}

/**
 * Point a partner at the Zoho customer it is billed as
 *
 * The link only ever got made as a side effect of raising an invoice, which
 * creates a customer where it finds none. So a distributor we had never
 * invoiced had no link and no way to make one — and its sales order, which
 * comes first, had nobody to be raised against.
 *
 * Candidates are offered rather than matched. Zoho holds "C D General Trading
 * L.L.C" and "CD General Trading LLC" as separate records of one company;
 * picking between them is a judgement, and picking wrong puts half a client's
 * invoices under each.
 */
const LinkZohoCustomerDialog = ({
  partnerId,
  partnerName,
  open,
  onOpenChange,
  onLinked,
}: LinkZohoCustomerDialogProps) => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');

  const { data, isFetching, error } = useQuery({
    ...api.partners.findZohoContacts.queryOptions({
      partnerId,
      ...(applied ? { search: applied } : {}),
    }),
    enabled: open,
  });

  const { mutate: link, isPending } = useMutation({
    ...api.partners.linkZohoContact.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`${result.name} is now billed as ${result.contactName}`);
      onOpenChange(false);
      onLinked?.();
    },
    onError: (linkError) => {
      toast.error('Could not link that customer', {
        description: linkError.message,
        duration: 12000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link {partnerName} to a Zoho customer</DialogTitle>
          <DialogDescription>
            Pick the customer this partner is invoiced as. Nothing new is
            created in Zoho.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search Zoho — default is "${partnerName}"`}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setApplied(search.trim());
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApplied(search.trim())}
              disabled={isFetching}
            >
              <Icon icon={IconSearch} size="sm" />
              Search
            </Button>
          </div>

          {isFetching && (
            <Typography variant="bodySm" className="text-text-muted">
              Asking Zoho...
            </Typography>
          )}

          {error && (
            <Typography variant="bodySm" className="text-text-muted">
              {error.message}
            </Typography>
          )}

          {!isFetching && data && data.candidates.length === 0 && (
            <Typography variant="bodySm" className="text-text-muted">
              Nothing in Zoho matched &ldquo;{data.searched}&rdquo;. Try a
              shorter search — Zoho matches on the whole name, so a full legal
              title with suffixes often finds nothing.
            </Typography>
          )}

          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {data?.candidates.map((candidate) => (
              <button
                key={candidate.contactId}
                type="button"
                disabled={isPending}
                onClick={() =>
                  link({ partnerId, contactId: candidate.contactId })
                }
                className="flex items-center gap-2.5 rounded-lg border border-border-muted px-3 py-2 text-left transition-colors hover:bg-surface-secondary/60 disabled:opacity-50"
              >
                <Icon
                  icon={IconBuildingStore}
                  size="sm"
                  className="shrink-0 text-text-muted"
                />
                <div className="min-w-0">
                  <Typography variant="bodySm" className="font-medium">
                    {candidate.name}
                  </Typography>
                  {(candidate.company || candidate.email) && (
                    <Typography
                      variant="bodyXs"
                      className="truncate text-text-muted"
                    >
                      {[candidate.company, candidate.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  )}
                  {/*
                    The id, because two records of one company often differ by
                    nothing a person can see — same name, same address, one of
                    them the account the invoices actually sit under.
                  */}
                  <code className="mt-0.5 block font-mono text-[11px] text-text-muted">
                    {candidate.contactId}
                  </code>
                </div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkZohoCustomerDialog;
