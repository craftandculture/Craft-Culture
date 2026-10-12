'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import ApplicationCard from './ApplicationCard';

type Filter = 'submitted' | 'draft' | 'approved' | 'declined';

const filters: { id: Filter; label: string }[] = [
  { id: 'submitted', label: 'Waiting for review' },
  { id: 'draft', label: 'Still filling in' },
  { id: 'approved', label: 'Approved' },
  { id: 'declined', label: 'Declined' },
];

/**
 * Private Cellar applications, waiting ones first
 *
 * "Still filling in" lists people who have given a name but not submitted —
 * worth a WhatsApp, since nothing about the form should have stopped them.
 */
const ApplicationsList = () => {
  const api = useTRPC();
  const [filter, setFilter] = useState<Filter>('submitted');
  const { data = [], isLoading, refetch } = useQuery(api.onboarding.admin.listApplications.queryOptions());

  const shown = data.filter((row) => row.application.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((item) => {
          const count = data.filter((row) => row.application.status === item.id).length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === item.id
                  ? 'bg-text-primary text-surface-primary'
                  : 'border-border-muted text-text-muted hover:text-text-primary border'
              }`}
            >
              {item.label}
              {count > 0 && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading applications...
        </Typography>
      )}

      {!isLoading && shown.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <Typography variant="bodyMd" colorRole="muted">
            {filter === 'submitted' ? 'No applications waiting.' : 'Nothing here.'}
          </Typography>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((row) => (
          <ApplicationCard key={row.application.id} row={row} onChanged={() => void refetch()} />
        ))}
      </div>
    </div>
  );
};

export default ApplicationsList;
