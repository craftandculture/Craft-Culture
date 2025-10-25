'use client';

import parse from 'another-name-parser';
import { format } from 'date-fns';
import { useState } from 'react';

import Table from '@/app/_ui/components/Table/Table';
import TableBody from '@/app/_ui/components/Table/TableBody';
import TableCell from '@/app/_ui/components/Table/TableCell';
import TableHead from '@/app/_ui/components/Table/TableHead';
import TableHeader from '@/app/_ui/components/Table/TableHeader';
import TableRow from '@/app/_ui/components/Table/TableRow';
import Typography from '@/app/_ui/components/Typography/Typography';
import api from '@/lib/trpc/browser';

const ActivityLogsTable = () => {
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = api.admin.activityLogs.getMany.useQuery({
    limit,
    offset: page * limit,
  });

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Typography colorRole="muted">Loading activity logs...</Typography>
      </div>
    );
  }

  if (!data?.logs || data.logs.length === 0) {
    return (
      <div className="py-8 text-center">
        <Typography colorRole="muted">No activity logs found</Typography>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>IP Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <Typography variant="bodySm" className="font-mono">
                  {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                </Typography>
              </TableCell>
              <TableCell>
                <div>
                  <Typography variant="bodySm">
                    {log.admin?.name
                      ? (() => {
                          const parsed = parse(log.admin.name);
                          return parsed.first || parsed.last
                            ? `${parsed.first} ${parsed.last}`.trim()
                            : log.admin.email ?? 'Unknown';
                        })()
                      : log.admin?.email ?? 'Unknown'}
                  </Typography>
                  {log.admin?.email && log.admin.name && (() => {
                    const parsed = parse(log.admin.name);
                    return parsed.first || parsed.last;
                  })() && (
                    <Typography variant="bodySm" colorRole="muted" className="text-xs">
                      {log.admin.email}
                    </Typography>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Typography variant="bodySm" className="font-mono">
                  {log.action}
                </Typography>
              </TableCell>
              <TableCell>
                {log.entityType ? (
                  <div>
                    <Typography variant="bodySm">{log.entityType}</Typography>
                    {log.entityId && (
                      <Typography variant="bodySm" colorRole="muted" className="text-xs font-mono">
                        {log.entityId.slice(0, 8)}...
                      </Typography>
                    )}
                  </div>
                ) : (
                  <Typography variant="bodySm" colorRole="muted">
                    -
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="bodySm" className="font-mono">
                  {log.ipAddress ?? '-'}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.total > limit && (
        <div className="flex items-center justify-between">
          <Typography variant="bodySm" colorRole="muted">
            Showing {page * limit + 1} - {Math.min((page + 1) * limit, data.total)} of {data.total}
          </Typography>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= data.total}
              className="rounded px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogsTable;
