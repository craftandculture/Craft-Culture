'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import OrphanOrderBackfill from '@/app/_privateClientContacts/components/OrphanOrderBackfill';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Every private client, across every partner
 *
 * A partner sees only their own book, which is right. C&C raise orders for all
 * of them and chase verifications for all of them, and until now had no way to
 * see the whole thing — so a client's history lived wherever the order that
 * created it happened to be.
 */
const AdminClientsPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    partnerId: '',
    name: '',
    email: '',
    phone: '',
    addressLine1: '',
    city: '',
    verified: false,
  });

  // The simple list: id and name, which is all a chooser needs.
  const partners = useQuery(api.partners.list.queryOptions({}));

  const createClient = useMutation({
    ...api.privateClientContacts.adminCreateForPartner.mutationOptions(),
    onSuccess: async (created) => {
      toast.success(
        `${created.name} added${created.verified ? ' and marked verified' : ''}`,
      );
      setDraft((current) => ({
        ...current,
        name: '',
        email: '',
        phone: '',
        addressLine1: '',
        city: '',
      }));
      setAdding(false);
      await queryClient.invalidateQueries({
        queryKey: api.privateClientContacts.adminGetAll.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const clients = useQuery(
    api.privateClientContacts.adminGetAll.queryOptions({
      search: search.trim() || undefined,
      unverifiedOnly,
    }),
  );

  const rows = clients.data?.rows ?? [];
  const summary = clients.data?.summary;

  return (
    <div className="space-y-5 p-6">
      <div>
        <Typography variant="headingLg">Clients</Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1">
            Every private client across all partners. Partners see only their
            own; this is the whole book.
          </p>
        </Typography>
      </div>

      <OrphanOrderBackfill />

      {summary ? (
        <div className="flex flex-wrap gap-5">
          {[
            { label: 'clients', value: summary.total },
            { label: 'not verified', value: summary.unverified },
            { label: 'never ordered', value: summary.neverOrdered },
            { label: 'duplicated emails', value: summary.duplicateEmails },
          ].map((stat) => (
            <div key={stat.label}>
              <Typography variant="headingSm" asChild>
                <p className="tabular-nums">
                  {stat.value.toLocaleString('en-GB')}
                </p>
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p>{stat.label}</p>
              </Typography>
            </div>
          ))}
        </div>
      ) : null}

      {adding ? (
        <div className="border-border-primary rounded-xl border p-4">
          <Typography variant="labelSm">Add a client</Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-0.5 mb-3">
              Tick verified only where the distributor has already cleared them
              — it is their word, and an order for an unverified client stops at
              verification.
            </p>
          </Typography>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-text-muted text-xs">Partner *</span>
              <select
                value={draft.partnerId}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, partnerId: event.target.value }))
                }
                className="border-border-primary bg-fill-primary min-h-9 rounded-md border px-2 text-sm"
              >
                <option value="">Choose a partner…</option>
                {(partners.data ?? []).map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ['name', 'Client name *'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['addressLine1', 'Address'],
                ['city', 'City'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex flex-col gap-1">
                <span className="text-text-muted text-xs">{label}</span>
                <Input
                  value={draft[field]}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, [field]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.verified}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, verified: event.target.checked }))
                }
              />
              <Typography variant="bodySm">
                Verified by the distributor
              </Typography>
            </label>
            <Button
              size="sm"
              colorRole="brand"
              isDisabled={
                createClient.isPending ||
                !draft.partnerId ||
                !draft.name.trim()
              }
              onClick={() =>
                createClient.mutate({
                  partnerId: draft.partnerId,
                  name: draft.name,
                  email: draft.email || undefined,
                  phone: draft.phone || undefined,
                  addressLine1: draft.addressLine1 || undefined,
                  city: draft.city || undefined,
                  verified: draft.verified,
                })
              }
            >
              {createClient.isPending ? 'Adding…' : 'Add client'}
            </Button>
            <Button
              size="sm"
              colorRole="muted"
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-80">
          <Input
            placeholder="Search name, email or phone…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          size="sm"
          colorRole={unverifiedOnly ? 'brand' : 'muted'}
          variant={unverifiedOnly ? 'default' : 'outline'}
          onClick={() => setUnverifiedOnly((current) => !current)}
        >
          Not yet verified
        </Button>
        <Typography variant="bodySm" colorRole="muted">
          {rows.length} shown
        </Typography>
        <Button
          size="sm"
          colorRole="brand"
          onClick={() => setAdding((current) => !current)}
        >
          Add client
        </Button>
      </div>

      {clients.isLoading ? (
        <Typography variant="bodySm" colorRole="muted">
          Loading clients…
        </Typography>
      ) : rows.length === 0 ? (
        <div className="border-border-primary rounded-xl border p-8 text-center">
          <Typography variant="bodySm" colorRole="muted">
            No clients match that.
          </Typography>
        </div>
      ) : (
        <div className="border-border-primary overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted bg-fill-muted/20 sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Partner</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="px-3 py-2 font-medium">Verified</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-border-primary border-t align-top"
                >
                  <td className="px-3 py-2">
                    {row.name}
                    {row.duplicateEmail ? (
                      <Badge size="xs" colorRole="warning" className="ml-2">
                        duplicate email
                      </Badge>
                    ) : null}
                    {row.address ? (
                      <span className="text-text-muted block text-xs">
                        {row.address}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-text-muted px-3 py-2">
                    {row.partnerName ?? '—'}
                  </td>
                  <td className="text-text-muted px-3 py-2 text-xs">
                    {row.email ?? '—'}
                    {row.phone ? (
                      <span className="block">{row.phone}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.orders}
                  </td>
                  <td className="px-3 py-2">
                    {row.verifiedAt ? (
                      <Badge size="xs" colorRole="success">
                        verified
                      </Badge>
                    ) : (
                      <Badge size="xs" colorRole="warning">
                        not yet
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminClientsPage;
