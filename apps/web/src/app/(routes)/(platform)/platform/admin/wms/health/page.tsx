'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconCloud,
  IconDatabase,
  IconPrinter,
  IconRefresh,
  IconServer,
  IconWifi,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useLocalServer } from '@/app/_wms/providers/LocalServerProvider';
import { usePrinterContext } from '@/app/_wms/providers/PrinterProvider';
import useTRPC from '@/lib/trpc/browser';

const AUTO_REFRESH_MS = 30_000;

/**
 * Status dot component for health indicators
 */
const StatusDot = ({ status }: { status: 'green' | 'amber' | 'red' | 'gray' }) => {
  const colors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };

  return (
    <span className={`inline-block h-3 w-3 rounded-full ${colors[status]}`} />
  );
};

/**
 * Format latency with color coding
 */
const LatencyBadge = ({ ms }: { ms: number }) => {
  const color = ms < 100 ? 'text-emerald-600' : ms < 750 ? 'text-amber-600' : 'text-red-600';
  return <span className={`text-sm font-mono ${color}`}>{ms}ms</span>;
};

/**
 * Time since a given ISO timestamp
 */
const TimeSince = ({ timestamp }: { timestamp: string }) => {
  const [label, setLabel] = useState('just now');

  useEffect(() => {
    const update = () => {
      const seconds = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000);
      if (seconds < 5) setLabel('just now');
      else if (seconds < 60) setLabel(`${seconds}s ago`);
      else setLabel(`${Math.round(seconds / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [timestamp]);

  return <span className="text-xs text-text-muted">{label}</span>;
};

/**
 * WMS System Health Check page
 */
const WMSHealthPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { printers, printerStatus } = usePrinterContext();
  const { isAvailable: nucAvailable, baseUrl: nucUrl } = useLocalServer();
  const [isOnline, setIsOnline] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track online/offline
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // DB health check
  const { data: dbHealth } = useQuery({
    ...api.wms.admin.health.checkDb.queryOptions(),
    refetchInterval: AUTO_REFRESH_MS,
  });

  // Zoho health check
  const { data: zohoHealth } = useQuery({
    ...api.wms.admin.health.checkZoho.queryOptions(),
    refetchInterval: AUTO_REFRESH_MS,
  });

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: api.wms.admin.health.checkDb.queryKey() });
    await queryClient.invalidateQueries({ queryKey: api.wms.admin.health.checkZoho.queryKey() });
    setIsRefreshing(false);
  };

  // Compute overall status
  const onlinePrinters = printers.filter((p) => p.enabled && printerStatus[p.id]);
  const enabledPrinters = printers.filter((p) => p.enabled);
  const dbOk = dbHealth?.status === 'connected';
  const zohoOk = zohoHealth?.status === 'connected';
  const nucOk = nucAvailable;

  const issueCount =
    (dbOk ? 0 : 1) +
    (zohoOk ? 0 : 1) +
    (nucOk ? 0 : 1) +
    (isOnline ? 0 : 1) +
    (enabledPrinters.length - onlinePrinters.length);

  // Vercel build info
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

  return (
    <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/admin/wms">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg">System Health</Typography>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
          >
            <ButtonContent iconLeft={IconRefresh}>
              {isRefreshing ? 'Checking...' : 'Refresh'}
            </ButtonContent>
          </Button>
        </div>

        {/* Overall Status Banner */}
        <Card className={issueCount === 0 ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <StatusDot status={issueCount === 0 ? 'green' : 'red'} />
              <Typography variant="headingSm">
                {issueCount === 0
                  ? 'All Systems Operational'
                  : `${issueCount} Issue${issueCount > 1 ? 's' : ''} Detected`}
              </Typography>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostics Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Network */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon={IconWifi} size="md" className="text-text-muted" />
                  <Typography variant="headingSm">Network</Typography>
                </div>
                <StatusDot status={isOnline ? 'green' : 'red'} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">Internet</Typography>
                  <div className="flex items-center gap-1.5">
                    <Icon icon={isOnline ? IconCheck : IconX} size="xs" className={isOnline ? 'text-emerald-600' : 'text-red-600'} />
                    <Typography variant="bodySm" className={isOnline ? 'text-emerald-600' : 'text-red-600'}>
                      {isOnline ? 'Online' : 'Offline'}
                    </Typography>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon={IconDatabase} size="md" className="text-text-muted" />
                  <Typography variant="headingSm">Database</Typography>
                </div>
                <StatusDot status={dbHealth ? (dbOk ? 'green' : 'red') : 'gray'} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">Connection</Typography>
                  <div className="flex items-center gap-1.5">
                    <Icon icon={dbOk ? IconCheck : IconX} size="xs" className={dbOk ? 'text-emerald-600' : 'text-red-600'} />
                    <Typography variant="bodySm" className={dbOk ? 'text-emerald-600' : 'text-red-600'}>
                      {dbHealth?.status === 'connected' ? 'Connected' : dbHealth?.status ?? 'Checking...'}
                    </Typography>
                  </div>
                </div>
                {dbHealth?.latencyMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <Typography variant="bodySm" colorRole="muted">Latency</Typography>
                    <LatencyBadge ms={dbHealth.latencyMs} />
                  </div>
                )}
                {dbHealth?.timestamp && (
                  <div className="flex items-center justify-between">
                    <Typography variant="bodySm" colorRole="muted">Last check</Typography>
                    <TimeSince timestamp={dbHealth.timestamp} />
                  </div>
                )}
                {dbHealth?.status === 'error' && 'error' in dbHealth && (
                  <Typography variant="bodyXs" className="text-red-600 break-all">
                    {dbHealth.error}
                  </Typography>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Local Server (NUC) */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon={IconServer} size="md" className="text-text-muted" />
                  <Typography variant="headingSm">Local Server</Typography>
                </div>
                <StatusDot status={nucOk ? 'green' : 'red'} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">Status</Typography>
                  <div className="flex items-center gap-1.5">
                    <Icon icon={nucOk ? IconCheck : IconX} size="xs" className={nucOk ? 'text-emerald-600' : 'text-red-600'} />
                    <Typography variant="bodySm" className={nucOk ? 'text-emerald-600' : 'text-red-600'}>
                      {nucOk ? 'Available' : 'Unavailable'}
                    </Typography>
                  </div>
                </div>
                {nucUrl && (
                  <div className="flex items-center justify-between">
                    <Typography variant="bodySm" colorRole="muted">URL</Typography>
                    <Typography variant="bodyXs" className="font-mono text-text-muted">{nucUrl}</Typography>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Zoho API */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon={IconCloud} size="md" className="text-text-muted" />
                  <Typography variant="headingSm">Zoho API</Typography>
                </div>
                <StatusDot
                  status={
                    zohoHealth
                      ? zohoHealth.status === 'connected'
                        ? 'green'
                        : zohoHealth.status === 'not_configured'
                          ? 'gray'
                          : zohoHealth.status === 'token_error'
                            ? 'red'
                            : 'amber'
                      : 'gray'
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">Configured</Typography>
                  <div className="flex items-center gap-1.5">
                    <Icon icon={zohoHealth?.configured ? IconCheck : IconX} size="xs" className={zohoHealth?.configured ? 'text-emerald-600' : 'text-text-muted'} />
                    <Typography variant="bodySm" className={zohoHealth?.configured ? 'text-emerald-600' : 'text-text-muted'}>
                      {zohoHealth?.configured ? 'Yes' : 'No'}
                    </Typography>
                  </div>
                </div>
                {zohoHealth?.configured && (
                  <>
                    <div className="flex items-center justify-between">
                      <Typography variant="bodySm" colorRole="muted">Token</Typography>
                      <div className="flex items-center gap-1.5">
                        <Icon icon={zohoHealth.tokenValid ? IconCheck : IconX} size="xs" className={zohoHealth.tokenValid ? 'text-emerald-600' : 'text-red-600'} />
                        <Typography variant="bodySm" className={zohoHealth.tokenValid ? 'text-emerald-600' : 'text-red-600'}>
                          {zohoHealth.tokenValid ? 'Valid' : 'Invalid'}
                        </Typography>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Typography variant="bodySm" colorRole="muted">API</Typography>
                      <div className="flex items-center gap-1.5">
                        <Icon icon={zohoHealth.apiReachable ? IconCheck : IconX} size="xs" className={zohoHealth.apiReachable ? 'text-emerald-600' : 'text-red-600'} />
                        <Typography variant="bodySm" className={zohoHealth.apiReachable ? 'text-emerald-600' : 'text-red-600'}>
                          {zohoHealth.apiReachable ? 'Reachable' : 'Unreachable'}
                        </Typography>
                      </div>
                    </div>
                  </>
                )}
                {zohoHealth?.latencyMs !== undefined && zohoHealth.latencyMs > 0 && (
                  <div className="flex items-center justify-between">
                    <Typography variant="bodySm" colorRole="muted">Latency</Typography>
                    <LatencyBadge ms={zohoHealth.latencyMs} />
                  </div>
                )}
                {zohoHealth?.timestamp && (
                  <div className="flex items-center justify-between">
                    <Typography variant="bodySm" colorRole="muted">Last check</Typography>
                    <TimeSince timestamp={zohoHealth.timestamp} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Printers Section */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon={IconPrinter} size="md" className="text-text-muted" />
                <Typography variant="headingSm">Printers</Typography>
              </div>
              <Typography variant="bodySm" colorRole="muted">
                {onlinePrinters.length}/{enabledPrinters.length} online
              </Typography>
            </div>

            {printers.length === 0 ? (
              <Typography variant="bodySm" colorRole="muted">
                No printers configured. Open printer settings on any WMS page to add printers.
              </Typography>
            ) : (
              <div className="space-y-3">
                {printers.map((printer) => {
                  const online = printerStatus[printer.id];
                  return (
                    <div key={printer.id} className="flex items-center gap-3 rounded-lg bg-fill-secondary p-3">
                      <StatusDot
                        status={!printer.enabled ? 'gray' : online ? 'green' : 'red'}
                      />
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="font-medium truncate">
                          {printer.name}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {printer.ip} &middot; {printer.labelSize}
                        </Typography>
                      </div>
                      <Typography variant="bodyXs" className={
                        !printer.enabled
                          ? 'text-text-muted'
                          : online
                            ? 'text-emerald-600'
                            : 'text-red-600'
                      }>
                        {!printer.enabled ? 'Disabled' : online ? 'Online' : 'Offline'}
                      </Typography>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Info */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Typography variant="headingSm">App Info</Typography>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Typography variant="bodySm" colorRole="muted">Environment</Typography>
                <Typography variant="bodySm" className="font-mono">
                  {vercelEnv ?? 'development'}
                </Typography>
              </div>
              {commitSha && (
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">Build</Typography>
                  <Typography variant="bodySm" className="font-mono">
                    {commitSha.slice(0, 7)}
                  </Typography>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Typography variant="bodySm" colorRole="muted">Auto-refresh</Typography>
                <Typography variant="bodySm" className="font-mono">
                  {AUTO_REFRESH_MS / 1000}s
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WMSHealthPage;
