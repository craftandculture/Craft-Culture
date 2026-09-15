'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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

  const [search, setSearch] = useState('');
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);

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
