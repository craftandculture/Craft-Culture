'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import useTRPC from '@/lib/trpc/browser';

export interface ZohoCustomerLinkProps {
  partnerId: string;
  memberName: string;
  zohoContactId: string | null;
  onLinked: () => void;
}

/**
 * Which Zoho Books customer a member is billed as
 *
 * A member's Invoices page reads only this link, so until it is set they see no
 * invoices, however many Zoho holds. Candidates are searched by name and a
 * person picks: Zoho holds duplicates, and choosing one silently is how a
 * member ends up seeing someone else's invoices.
 */
const ZohoCustomerLink = ({
  partnerId,
  memberName,
  zohoContactId,
  onLinked,
}: ZohoCustomerLinkProps) => {
  const api = useTRPC();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searched, setSearched] = useState<string | undefined>(undefined);

  const { data, isFetching, error } = useQuery({
    ...api.partners.findZohoContacts.queryOptions({
      partnerId,
      search: searched,
    }),
    enabled: isOpen,
  });

  const link = useMutation(
    api.partners.linkZohoContact.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.name} linked to Zoho`);
        setIsOpen(false);
        onLinked();
      },
      onError: (linkError) => toast.error(linkError.message),
    }),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`text-xs ${zohoContactId ? 'text-text-muted hover:text-text-primary' : 'text-text-primary font-semibold'} hover:underline`}
      >
        {zohoContactId ? 'Linked' : 'Link'}
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zoho customer for {memberName}</DialogTitle>
            <DialogDescription>
              Their Invoices page shows the invoices of the customer linked
              here, and only those.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                setSearched(search.trim() || undefined);
              }}
            >
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Zoho by name"
                className="border-border-muted bg-surface-primary h-8 min-w-0 flex-1 rounded-md border px-2 text-xs"
              />
              <button
                type="submit"
                className="bg-text-primary text-surface-primary h-8 rounded-md px-2.5 text-xs font-semibold"
              >
                Find
              </button>
            </form>
            {isFetching && (
              <p className="text-text-muted text-xs">Searching Zoho&hellip;</p>
            )}
            {error && <p className="text-xs text-red-700">{error.message}</p>}
            {data && !isFetching && data.candidates.length === 0 && (
              <p className="text-text-muted text-xs">
                Nothing in Zoho for &ldquo;{data.searched}&rdquo;. Try another
                spelling.
              </p>
            )}
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {data?.candidates.map((candidate) => {
                const isCurrent = candidate.contactId === zohoContactId;
                return (
                  <li
                    key={candidate.contactId}
                    className="hover:bg-fill-muted/50 flex items-center justify-between gap-2 rounded-md px-1.5 py-1"
                  >
                    <span className="min-w-0">
                      <span className="text-text-primary block truncate text-xs font-medium">
                        {candidate.name}
                      </span>
                      <span className="text-text-muted block truncate text-[11px]">
                        {candidate.email ??
                          candidate.company ??
                          candidate.contactId}
                      </span>
                    </span>
                    {isCurrent ? (
                      <span className="text-text-muted text-[11px]">
                        Current
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={link.isPending}
                        onClick={() =>
                          link.mutate({
                            partnerId,
                            contactId: candidate.contactId,
                          })
                        }
                        className="text-text-primary text-xs font-semibold hover:underline disabled:opacity-50"
                      >
                        Link
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ZohoCustomerLink;
