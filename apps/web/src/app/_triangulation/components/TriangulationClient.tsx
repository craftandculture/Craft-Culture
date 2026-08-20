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
import NextStep from './NextStep';
import OverviewTab from './OverviewTab';
import SelectField from './SelectField';
import SkusTab from './SkusTab';
import ZohoCleanupTab from './ZohoCleanupTab';
import { CRURATED_PROGRAMME_ID } from '../utils/programmeId';

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

  /**
   * Which consignment programme is on screen.
   *
   * Null means Crurated, the programme every existing figure belongs to, so a
   * fresh load reads exactly as it did before there was more than one.
   */
  const [programmeId, setProgrammeId] = useState<string>(CRURATED_PROGRAMME_ID);
  /** Whether the partner picker for adding a client is open */
  const [addingClient, setAddingClient] = useState(false);
  const [newPartnerId, setNewPartnerId] = useState('');
  const [periodId, setPeriodId] = useState<string | null>(null);
  /** Controlled so the next-step strip can send someone to the right tab */
  const [tab, setTab] = useState('overview');

  // On the tab rather than inside it: work you cannot see is work nobody does,
  // and this one is finite, so the count falling is the point of it.
  const zohoCleanup = useQuery(
    api.triangulation.admin.getZohoCleanup.queryOptions(),
  );
  const zohoOutstanding =
    (zohoCleanup.data?.summary.deactivateOnly ?? 0) +
    (zohoCleanup.data?.summary.needsStandard ?? 0) +
    (zohoCleanup.data?.summary.noLwin ?? 0);

  const programmes = useQuery(
    api.triangulation.admin.getProgrammes.queryOptions(),
  );
  // Every active partner, so a client is picked from the record their orders
  // and invoices already hang off rather than typed in a second time.
  const partnerOptions = useQuery({
    ...api.partners.list.queryOptions({}),
    enabled: addingClient,
  });

  const createProgramme = useMutation({
    ...api.triangulation.admin.createProgramme.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        result.created
          ? `${result.name} added`
          : `${result.name} already had a programme`,
      );
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getProgrammes.queryKey(),
      });
      setProgrammeId(result.id);
      setAddingClient(false);
      setNewPartnerId('');
    },
    onError: (error) => toast.error(error.message),
  });
  const periods = useQuery(
    api.triangulation.admin.getPeriods.queryOptions({ programmeId }),
  );

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

  // Periods belong to a programme. Carrying one across would ask for a period
  // the new programme does not have, and the reconciliation would answer for
  // all time while the selector still named a month.
  useEffect(() => {
    setPeriodId(null);
  }, [programmeId]);
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
            label="Client"
            value={programmeId}
            onChange={(event) => setProgrammeId(event.target.value)}
          >
            {programmes.data?.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programme.name}
                {programme.skuCount === 0 ? ' · no wines yet' : ''}
              </option>
            ))}
          </SelectField>
          {addingClient ? (
            <>
              <SelectField
                label="Add a client"
                value={newPartnerId}
                onChange={(event) => setNewPartnerId(event.target.value)}
              >
                <option value="">— choose a partner —</option>
                {partnerOptions.data?.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </SelectField>
              <Button
                size="sm"
                colorRole="brand"
                isDisabled={!newPartnerId || createProgramme.isPending}
                onClick={() =>
                  createProgramme.mutate({ partnerId: newPartnerId })
                }
              >
                {createProgramme.isPending ? 'Adding…' : 'Add'}
              </Button>
              <Button
                size="sm"
                colorRole="muted"
                onClick={() => setAddingClient(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              colorRole="muted"
              onClick={() => setAddingClient(true)}
            >
              <IconPlus className="mr-1 size-4" />
              Add client
            </Button>
          )}
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

      <NextStep programmeId={programmeId} periodId={periodId} onGo={setTab} />

      <Tabs value={tab} onValueChange={setTab}>
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
          <TabsTrigger value="zoho">
            Fix Zoho
            {zohoOutstanding > 0 ? (
              <span className="text-text-warning ml-1">
                ({zohoOutstanding})
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <OverviewTab programmeId={programmeId} periodId={periodId} />
        </TabsContent>
        <TabsContent value="imports" className="pt-6">
          <ImportsTab
            programmeId={programmeId}
            periodId={periodId}
            periodEnd={selected?.periodEnd ?? null}
            isLocked={selected?.status === 'locked'}
          />
        </TabsContent>
        <TabsContent value="mapping" className="pt-6">
          <MappingTab programmeId={programmeId} />
        </TabsContent>
        <TabsContent value="skus" className="pt-6">
          <SkusTab programmeId={programmeId} />
        </TabsContent>
        <TabsContent value="zoho" className="pt-6">
          <ZohoCleanupTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TriangulationClient;
