'use client';

import { IconChevronRight, IconLayersLinked, IconLoader2, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const fmtUsd = (v: number | null) =>
  v == null ? '—' : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const ShipmentGroupsPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');

  const { data: groups, isLoading } = useQuery(api.logistics.admin.groups.getMany.queryOptions());

  const createMut = useMutation({
    ...api.logistics.admin.groups.create.mutationOptions(),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({
        queryKey: api.logistics.admin.groups.getMany.queryKey(),
      });
      toast.success('Group created');
      if (group?.id) router.push(`/platform/admin/logistics/groups/${group.id}`);
    },
    onError: () => toast.error('Failed to create group'),
  });

  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-secondary">
              <IconLayersLinked className="h-5 w-5 text-text-muted" />
            </div>
            <div>
              <Typography variant="headingMd">Consolidation Groups</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Group shipments on one freight invoice and spread the cost across every bottle
              </Typography>
            </div>
          </div>
          <Button variant="outline" onClick={() => setCreating((v) => !v)}>
            <ButtonContent iconLeft={IconPlus}>New group</ButtonContent>
          </Button>
        </div>

        {/* Create form */}
        {creating && (
          <Card>
            <CardContent className="gap-3 p-4">
              <Typography variant="labelSm">New consolidation group</Typography>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Name (e.g. AWB 020-1234 — 10 Jul flight)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  placeholder="AWB / flight / container ref (optional)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  <ButtonContent>Cancel</ButtonContent>
                </Button>
                <Button
                  disabled={!name.trim() || createMut.isPending}
                  onClick={() =>
                    createMut.mutate({
                      name: name.trim(),
                      reference: reference.trim() || null,
                      shipmentIds: [],
                    })
                  }
                >
                  <ButtonContent iconLeft={createMut.isPending ? IconLoader2 : IconPlus}>
                    Create
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <IconLoader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : !groups || groups.length === 0 ? (
          <Card>
            <CardContent className="items-center gap-2 py-12 text-center">
              <Typography variant="bodySm" colorRole="muted">
                No groups yet. Create one, add the shipments that travelled together, then allocate
                the freight invoice.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <Link key={g.id} href={`/platform/admin/logistics/groups/${g.id}`}>
                <Card className="transition-colors hover:border-border-brand">
                  <CardContent className="flex-row items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <Typography variant="labelMd" className="truncate">
                        {g.name}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {g.reference ? `${g.reference} · ` : ''}
                        {g.shipmentCount} shipment{g.shipmentCount !== 1 ? 's' : ''} ·{' '}
                        {g.totalCases.toLocaleString()} cases · {g.totalBottles.toLocaleString()}{' '}
                        bottles
                      </Typography>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Typography variant="labelSm">{fmtUsd(g.totalLandedCostUsd)}</Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {g.allocatedAt ? 'landed cost' : 'not allocated'}
                        </Typography>
                      </div>
                      <IconChevronRight className="h-4 w-4 text-text-muted" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default ShipmentGroupsPage;
