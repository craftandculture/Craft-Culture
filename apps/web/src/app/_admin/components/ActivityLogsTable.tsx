'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import DataTable from '@/app/_ui/components/DataTable/DataTable';
import Typography from '@/app/_ui/components/Typography/Typography';
import api from '@/lib/trpc/client';
import formatDate from '@/utils/formatDate';

interface ActivityLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  admin: {
    id: string;
    name: string;
    email: string;
  };
}

const ActivityLogsTable = () => {
  const { data } = api.admin.activityLogs.getMany.useQuery({
    limit: 100,
  });

  const columns = useMemo<ColumnDef<ActivityLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Date & Time',
        cell: ({ row }) => (
          <Typography variant="bodySm" className="whitespace-nowrap">
            {formatDate(row.original.createdAt, 'PPpp')}
          </Typography>
        ),
      },
      {
        accessorKey: 'admin.name',
        header: 'Admin User',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Typography variant="bodySm">{row.original.admin.name}</Typography>
            <Typography variant="bodySm" colorRole="muted">
              {row.original.admin.email}
            </Typography>
          </div>
        ),
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <Typography variant="bodySm" className="font-medium">
            {row.original.action}
          </Typography>
        ),
      },
      {
        accessorKey: 'entityType',
        header: 'Entity Type',
        cell: ({ row }) => (
          <Typography variant="bodySm">
            {row.original.entityType ?? '-'}
          </Typography>
        ),
      },
      {
        accessorKey: 'entityId',
        header: 'Entity ID',
        cell: ({ row }) => (
          <Typography variant="bodySm" className="font-mono text-xs">
            {row.original.entityId
              ? `${row.original.entityId.substring(0, 8)}...`
              : '-'}
          </Typography>
        ),
      },
      {
        accessorKey: 'ipAddress',
        header: 'IP Address',
        cell: ({ row }) => (
          <Typography variant="bodySm" className="font-mono text-xs">
            {row.original.ipAddress ?? '-'}
          </Typography>
        ),
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={data?.data ?? []} />;
};

export default ActivityLogsTable;
