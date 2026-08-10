'use client';

import { IconLock, IconLockOpen, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Tabs from '@/app/_ui/components/Tabs/Tabs';
import TabsContent from '@/app/_ui/components/Tabs/TabsContent';
import TabsList from '@/app/_ui/components/Tabs/TabsList';
import TabsTrigger from '@/app/_ui/components/Tabs/TabsTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import ImportsTab from './ImportsTab';
import MappingTab from './MappingTab';
import OverviewTab from './OverviewTab';
import SelectField from './SelectField';
import SkusTab from './SkusTab';

/** Month label and bounds for the period one month before `date` */
const previousMonthPeriod = (date: Date) => {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  return {
    label: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
};

/**
 * Stock triangulation workspace
 *
 * Everything is scoped to a reporting period so the monthly review is a fixed
 * thing that can be circulated and, once agreed, locked. Selecting "All time"
 * reconciles every input recorded to date, which is the right view when
 * chasing a discrepancy across several months.
 */
const TriangulationClient = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [periodId, setPeriodId] = useState<string | null>(null);

  const periods = useQuery(api.triangulation.admin.getPeriods.queryOptions());

  const createPeriod = useMutation({
    ...api.triangulation.admin.createPeriod.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(`Period ${result.label} created`);
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getPeriods.queryKey(),
      });
      setPeriodId(result.id);
    },
    onError: (error) => toast.error(error.message),
  });

  const setPeriodStatus = useMutation({
    ...api.triangulation.admin.setPeriodStatus.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(result.status === 'locked' ? 'Period locked' : 'Period reopened');
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getPeriods.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = useMemo(() => periods.data ?? [], [periods.data]);
  const selected = rows.find((row) => row.id === periodId) ?? null;

  // Land on the most recent period the first time the list arrives.
  useEffect(() => {
    if (periodId === null && rows.length > 0 && rows[0]) {
      setPeriodId(rows[0].id);
    }
  }, [rows, periodId]);

  const handleCreatePeriod = () => {
    const next = previousMonthPeriod(new Date());

    if (rows.some((row) => row.label === next.label)) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

      createPeriod.mutate({
        label: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10),
      });

      return;
    }

    createPeriod.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Reporting period"
            value={periodId ?? ''}
            onChange={(event) => setPeriodId(event.target.value || null)}
          >
            <option value="">All time</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} ({row.periodStart} → {row.periodEnd})
                {row.status === 'locked' ? ' · locked' : ''}
              </option>
            ))}
          </SelectField>

          {selected ? (
            <Badge colorRole={selected.status === 'locked' ? 'muted' : 'success'}>
              {selected.status === 'locked' ? 'Locked' : 'Open'}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {selected ? (
            <Button
              colorRole="muted"
              variant="outline"
              isDisabled={setPeriodStatus.isPending}
              onClick={() =>
                setPeriodStatus.mutate({
                  periodId: selected.id,
                  status: selected.status === 'locked' ? 'open' : 'locked',
                })
              }
            >
              {selected.status === 'locked' ? (
                <IconLockOpen className="mr-1 size-4" />
              ) : (
                <IconLock className="mr-1 size-4" />
              )}
              {selected.status === 'locked' ? 'Reopen' : 'Lock period'}
            </Button>
          ) : null}
          <Button
            colorRole="brand"
            isDisabled={createPeriod.isPending}
            onClick={handleCreatePeriod}
          >
            <IconPlus className="mr-1 size-4" />
            New period
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Typography variant="bodySm" colorRole="muted">
          No reporting periods yet. Create one to start attaching the monthly
          inputs — or work in &ldquo;All time&rdquo; and add periods later.
        </Typography>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Reconciliation</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="mapping">
            Mapping
            {(selected?.unmappedLines ?? 0) > 0 ? (
              <span className="text-text-warning ml-1">
                ({selected?.unmappedLines})
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="skus">SKUs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <OverviewTab periodId={periodId} />
        </TabsContent>
        <TabsContent value="imports" className="pt-6">
          <ImportsTab
            periodId={periodId}
            periodEnd={selected?.periodEnd ?? null}
            isLocked={selected?.status === 'locked'}
          />
        </TabsContent>
        <TabsContent value="mapping" className="pt-6">
          <MappingTab />
        </TabsContent>
        <TabsContent value="skus" className="pt-6">
          <SkusTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TriangulationClient;
