'use client';

import {
  IconCalculator,
  IconDotsVertical,
  IconFileSpreadsheet,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import DropdownMenu from '@/app/_ui/components/DropdownMenu/DropdownMenu';
import DropdownMenuContent from '@/app/_ui/components/DropdownMenu/DropdownMenuContent';
import DropdownMenuItem from '@/app/_ui/components/DropdownMenu/DropdownMenuItem';
import DropdownMenuTrigger from '@/app/_ui/components/DropdownMenu/DropdownMenuTrigger';
import Icon from '@/app/_ui/components/Icon/Icon';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * List of pricing sessions with actions
 */
const SessionsList = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery(
    api.pricingCalc.session.getMany.queryOptions({
      limit: 50,
      offset: 0,
    }),
  );

  const deleteMutation = useMutation({
    ...api.pricingCalc.session.delete.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.pricingCalc.session.getMany.queryKey(),
      });
      setDeletingId(null);
    },
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; colorRole: 'muted' | 'info' | 'success' | 'warning' }> = {
      draft: { label: 'Draft', colorRole: 'muted' },
      mapped: { label: 'Mapped', colorRole: 'info' },
      calculated: { label: 'Calculated', colorRole: 'success' },
      exported: { label: 'Exported', colorRole: 'success' },
    };
    const { label, colorRole } = config[status] || { label: status, colorRole: 'muted' as const };
    return <Badge colorRole={colorRole} size="sm">{label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data?.sessions.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Icon icon={IconCalculator} size="xl" colorRole="muted" className="mx-auto mb-4" />
          <Typography variant="headingSm" className="mb-2">
            No pricing sessions yet
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-4">
            Upload a supplier price sheet to get started
          </Typography>
          <Link href="/platform/admin/pricing-calculator/new">
            <Button variant="default" colorRole="brand">
              <ButtonContent iconLeft={IconPlus}>New Session</ButtonContent>
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.sessions.map((session) => (
        <Card key={session.id} className="transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                <Icon icon={IconFileSpreadsheet} size="md" colorRole="muted" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/platform/admin/pricing-calculator/${session.id}`}
                  className="hover:underline"
                >
                  <Typography variant="bodySm" className="font-medium truncate">
                    {session.name}
                  </Typography>
                </Link>
                <Typography variant="bodyXs" colorRole="muted">
                  {session.sourceFileName || 'Google Sheet'} · {session.itemCount || 0} items ·{' '}
                  {formatDate(session.createdAt)}
                </Typography>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(session.status)}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Icon icon={IconDotsVertical} size="sm" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => {
                        setDeletingId(session.id);
                        deleteMutation.mutate({ id: session.id });
                      }}
                      disabled={deletingId === session.id}
                    >
                      <Icon icon={IconTrash} size="sm" className="mr-2" />
                      {deletingId === session.id ? 'Deleting...' : 'Delete'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SessionsList;
