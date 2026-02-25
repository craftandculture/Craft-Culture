'use client';

import {
  IconAlertTriangle,
  IconBarcode,
  IconBox,
  IconBoxSeam,
  IconBuildingWarehouse,
  IconClipboardCheck,
  IconGripVertical,
  IconHeartbeat,
  IconMapPin,
  IconPackage,
  IconPackages,
  IconPlus,
  IconTransfer,
  IconTruck,
  IconUserDollar,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import ConnectionStatus from '@/app/_wms/components/ConnectionStatus';
import MovementTypeBadge from '@/app/_wms/components/MovementTypeBadge';
import useTRPC from '@/lib/trpc/browser';

// Quick action configuration
interface QuickAction {
  id: string;
  href: string;
  icon: typeof IconPackage;
  label: string;
  color: string;
  bgColor: string;
}

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: 'receive', href: '/platform/admin/wms/receive', icon: IconPackage, label: 'Receive', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { id: 'check', href: '/platform/admin/wms/stock/check', icon: IconClipboardCheck, label: 'Check', color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  { id: 'pick', href: '/platform/admin/wms/pick', icon: IconBox, label: 'Pick', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'transfer', href: '/platform/admin/wms/transfer', icon: IconTransfer, label: 'Transfer', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  { id: 'dispatch', href: '/platform/admin/wms/dispatch', icon: IconTruck, label: 'Dispatch', color: 'text-rose-600', bgColor: 'bg-rose-100 dark:bg-rose-900/30' },
  { id: 'repack', href: '/platform/admin/wms/repack', icon: IconPackages, label: 'Repack', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
];

/**
 * WMS Dashboard content component - renders the dashboard UI
 * Data is prefetched on the server and hydrated here
 */
const WMSDashboardContent = () => {
  const api = useTRPC();
  const router = useRouter();

  // Quick actions order (customizable)
  const [quickActionsOrder, setQuickActionsOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wms-quick-actions-order');
      if (saved) {
        try {
          return JSON.parse(saved) as string[];
        } catch {
          // Ignore parse error
        }
      }
    }
    return DEFAULT_QUICK_ACTIONS.map((a) => a.id);
  });

  // Dragging state for reordering
  const [isDragging, setIsDragging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Ctrl/Cmd is pressed and not in an input
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault();
          router.push('/platform/admin/wms/receive');
          break;
        case 'p':
          e.preventDefault();
          router.push('/platform/admin/wms/pick');
          break;
        case 't':
          e.preventDefault();
          router.push('/platform/admin/wms/transfer');
          break;
        case 'c':
          e.preventDefault();
          router.push('/platform/admin/wms/stock/check');
          break;
        case 'd':
          e.preventDefault();
          router.push('/platform/admin/wms/dispatch');
          break;
        case 's':
          e.preventDefault();
          router.push('/platform/admin/wms/stock');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Save quick actions order to localStorage
  const saveQuickActionsOrder = useCallback((order: string[]) => {
    setQuickActionsOrder(order);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wms-quick-actions-order', JSON.stringify(order));
    }
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
    setIsDragging(true);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const newOrder = [...quickActionsOrder];
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    saveQuickActionsOrder(newOrder);
  }, [draggedId, quickActionsOrder, saveQuickActionsOrder]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setIsDragging(false);
  }, []);

  // Get ordered quick actions (append any new actions not in saved order)
  const orderedQuickActions = (() => {
    const allIds = DEFAULT_QUICK_ACTIONS.map((a) => a.id);
    const missingIds = allIds.filter((id) => !quickActionsOrder.includes(id));
    const fullOrder = [...quickActionsOrder, ...missingIds];
    return fullOrder
      .map((id) => DEFAULT_QUICK_ACTIONS.find((a) => a.id === id))
      .filter((a): a is QuickAction => a !== undefined);
  })();

  // Fetch comprehensive overview (will use prefetched data)
  const { data: overview } = useQuery({
    ...api.wms.admin.stock.getOverview.queryOptions({}),
  });

  // Fetch recent movements (will use prefetched data)
  const { data: movements } = useQuery({
    ...api.wms.admin.stock.getMovements.queryOptions({ limit: 5 }),
  });

  // Fetch expiring stock alerts (will use prefetched data)
  const { data: expiringStock } = useQuery({
    ...api.wms.admin.stock.getExpiring.queryOptions({ daysThreshold: 90 }),
  });

  // Fetch pending partner requests (will use prefetched data)
  const { data: partnerRequests } = useQuery({
    ...api.wms.admin.ownership.getRequests.queryOptions({ status: 'pending', limit: 5, offset: 0 }),
  });

  // Fetch stock reconciliation status
  const { data: reconcileData } = useQuery({
    ...api.wms.admin.stock.reconcile.queryOptions(),
  });

  const hasExpiryAlerts =
    (expiringStock?.summary?.expiredCases ?? 0) > 0 ||
    (expiringStock?.summary?.criticalCases ?? 0) > 0;

  const pendingRequestCount = partnerRequests?.summary?.pendingCount ?? 0;
  const hasReconcileIssues = reconcileData?.summary && !reconcileData.summary.isReconciled;

  return (
    <>
      {/* Offline/Online Status Banner */}
      <ConnectionStatus />

      <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
        <div className="space-y-4">
          {/* Header */}
        <div className="flex items-center justify-between">
          <Typography variant="headingLg">
            WMS
          </Typography>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/admin/wms/scanner-test">
                <Icon icon={IconBarcode} size="sm" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="hidden sm:block">
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Shortcuts: Ctrl+R (Receive) · Ctrl+P (Pick) · Ctrl+C (Check) · Ctrl+T (Transfer) · Ctrl+D (Dispatch) · Ctrl+S (Stock)
          </Typography>
        </div>

        {/* KPI Summary - Compact */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-4 divide-x divide-border-primary text-center">
              <div className="px-2">
                <Typography variant="headingSm" className="text-purple-600">
                  {(overview?.summary?.totalCases ?? 0).toLocaleString()}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">cases</Typography>
              </div>
              <div className="px-2">
                <Typography variant="headingSm" className="text-emerald-600">
                  {overview?.summary?.uniqueProducts ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">products</Typography>
              </div>
              <div className="px-2">
                <Typography variant="headingSm" className="text-blue-600">
                  {overview?.locations?.occupied ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">locations</Typography>
              </div>
              <div className="px-2">
                <Typography variant="headingSm" className="text-cyan-600">
                  {overview?.movements?.last24Hours ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">moves</Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Alert: Stock Reconciliation Issue */}
        {hasReconcileIssues && (
          <Card className="border-red-500 bg-red-50 dark:border-red-700 dark:bg-red-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon icon={IconAlertTriangle} size="lg" className="text-red-600" />
                  <div>
                    <Typography variant="headingSm" className="text-red-800 dark:text-red-300">
                      Stock Reconciliation Required
                    </Typography>
                    <Typography variant="bodySm" className="text-red-700 dark:text-red-400">
                      {Math.abs(reconcileData?.summary.discrepancy ?? 0)} case
                      {Math.abs(reconcileData?.summary.discrepancy ?? 0) !== 1 ? 's' : ''}{' '}
                      {(reconcileData?.summary.discrepancy ?? 0) > 0 ? 'over' : 'under'} —
                      movements show {reconcileData?.summary.expectedStock} cases but stock has{' '}
                      {reconcileData?.summary.actualStock}
                    </Typography>
                  </div>
                </div>
                <Button colorRole="danger" size="sm" asChild>
                  <Link href="/platform/admin/wms/stock/reconcile">
                    <ButtonContent>Fix Now</ButtonContent>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts Section */}
        {(hasExpiryAlerts || pendingRequestCount > 0) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Expiry Alerts */}
            {hasExpiryAlerts && (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon={IconAlertTriangle} size="md" className="text-orange-600" />
                    <Typography variant="headingSm" className="text-orange-800 dark:text-orange-300">
                      Expiry Alerts
                    </Typography>
                  </div>
                  <div className="space-y-2">
                    {(expiringStock?.summary?.expiredCases ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <Typography variant="bodySm" className="text-red-600">
                          Expired
                        </Typography>
                        <Typography variant="headingSm" className="text-red-600">
                          {expiringStock?.summary?.expiredCases} cases
                        </Typography>
                      </div>
                    )}
                    {(expiringStock?.summary?.criticalCases ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <Typography variant="bodySm" className="text-orange-600">
                          Expiring &lt;30 days
                        </Typography>
                        <Typography variant="headingSm" className="text-orange-600">
                          {expiringStock?.summary?.criticalCases} cases
                        </Typography>
                      </div>
                    )}
                    {(expiringStock?.summary?.warningCases ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <Typography variant="bodySm" className="text-amber-600">
                          Expiring &lt;90 days
                        </Typography>
                        <Typography variant="headingSm" className="text-amber-600">
                          {expiringStock?.summary?.warningCases} cases
                        </Typography>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/platform/admin/wms/stock?expiring=true"
                    className="mt-3 block text-sm text-orange-700 underline hover:no-underline dark:text-orange-400"
                  >
                    View expiring stock →
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Pending Partner Requests */}
            {pendingRequestCount > 0 && (
              <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon={IconUsers} size="md" className="text-purple-600" />
                    <Typography variant="headingSm" className="text-purple-800 dark:text-purple-300">
                      Partner Requests
                    </Typography>
                  </div>
                  <Typography variant="headingLg" className="mb-1 text-purple-600">
                    {pendingRequestCount} pending
                  </Typography>
                  <Typography variant="bodyXs" className="text-purple-700 dark:text-purple-400">
                    requests awaiting review
                  </Typography>
                  <Link
                    href="/platform/admin/wms/ownership/requests"
                    className="mt-3 block text-sm text-purple-700 underline hover:no-underline dark:text-purple-400"
                  >
                    Review requests →
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick Actions - Large touch targets for mobile, draggable for customization */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {orderedQuickActions.map((action) => (
            <div
              key={action.id}
              draggable
              onDragStart={() => handleDragStart(action.id)}
              onDragOver={(e) => handleDragOver(e, action.id)}
              onDragEnd={handleDragEnd}
              className={`${isDragging && draggedId === action.id ? 'opacity-50' : ''}`}
            >
              <Link href={action.href}>
                <Card className="cursor-pointer transition-colors hover:border-border-brand active:bg-fill-secondary">
                  <CardContent className="relative flex flex-col items-center justify-center p-6">
                    <div className="absolute right-2 top-2 cursor-grab opacity-30 hover:opacity-60">
                      <Icon icon={IconGripVertical} size="sm" />
                    </div>
                    <div className={`mb-2 flex h-14 w-14 items-center justify-center rounded-xl ${action.bgColor}`}>
                      <Icon icon={action.icon} size="xl" className={action.color} />
                    </div>
                    <Typography variant="headingSm">{action.label}</Typography>
                  </CardContent>
                </Card>
              </Link>
            </div>
          ))}
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Link href="/platform/admin/wms/stock">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBox} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Stock</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/pallets">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBoxSeam} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Pallets</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/labels">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBarcode} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Labels</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/locations">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconMapPin} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Locations</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/bin-map">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBuildingWarehouse} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Bin Map</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/cycle-count">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconClipboardCheck} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Count</Typography>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Movements - Compact */}
        {movements?.movements && movements.movements.length > 0 && (
          <Card>
            <div className="flex items-center justify-between p-3 pb-2">
              <Typography variant="bodySm" className="font-medium">Recent Activity</Typography>
              <Link href="/platform/admin/wms/movements" className="text-xs text-text-muted">
                All →
              </Link>
            </div>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                {movements.movements.slice(0, 6).map((movement) => (
                  <div key={movement.id} className="flex items-center gap-2 text-sm">
                    <MovementTypeBadge
                      movementType={movement.movementType as 'receive' | 'putaway' | 'transfer' | 'pick' | 'adjust' | 'count' | 'ownership_transfer' | 'repack_out' | 'repack_in' | 'pallet_add' | 'pallet_remove' | 'pallet_move'}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="min-w-0 flex-1 truncate text-text-muted">
                      {movement.productName?.substring(0, 25)}...
                    </span>
                    <span className="font-medium text-blue-600">{movement.quantityCases}cs</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* More Options */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              <Link href="/platform/admin/wms/movements" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconTransfer} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Movements</Typography>
              </Link>
              <Link href="/platform/admin/wms/ownership/requests" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconUsers} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Requests</Typography>
                {pendingRequestCount > 0 && (
                  <span className="ml-auto rounded-full bg-purple-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    {pendingRequestCount}
                  </span>
                )}
              </Link>
              <Link href="/platform/admin/wms/ownership/transfer" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconUserDollar} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Ownership</Typography>
              </Link>
              <Link href="/platform/admin/wms/stock/reconcile" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconAlertTriangle} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Reconcile</Typography>
              </Link>
              <Link href="/platform/admin/wms/health" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconHeartbeat} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Health</Typography>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Setup Notice */}
        {(overview?.locations?.total ?? 0) === 0 && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
            <CardContent className="p-4 text-center">
              <Icon icon={IconBuildingWarehouse} size="lg" colorRole="muted" className="mx-auto mb-2" />
              <Typography variant="bodySm" className="mb-3">
                Create locations to get started
              </Typography>
              <Button asChild size="lg" className="w-full">
                <Link href="/platform/admin/wms/locations/new">
                  <ButtonContent iconLeft={IconPlus}>Create Locations</ButtonContent>
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  );
};

export default WMSDashboardContent;
