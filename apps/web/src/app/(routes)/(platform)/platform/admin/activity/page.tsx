'use client';

import {
  IconCheck,
  IconCurrencyDollar,
  IconDownload,
  IconEdit,
  IconFileText,
  IconFilter,
  IconLogin,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconSend,
  IconUser,
  IconUserPlus,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import markActivitiesAsViewed from '@/app/_admin/actions/markActivitiesAsViewed';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Activity feed page for admin users
 *
 * Displays all user activities with filtering options
 */
const ActivityFeedPage = () => {
  const api = useTRPC();

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Mark activities as viewed when page opens
  useEffect(() => {
    void markActivitiesAsViewed();
  }, []);

  const {
    data: activityData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    ...api.admin.userActivityLogs.getMany.queryOptions({
      limit: 100,
      offset: 0,
      action: actionFilter !== 'all' ? actionFilter : undefined,
    }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getActivityIcon = (action: string) => {
    const iconClass = 'h-4 w-4';
    if (action.includes('signin')) return <IconLogin className={`${iconClass} text-text-brand`} />;
    if (action.includes('signup'))
      return <IconUserPlus className={`${iconClass} text-text-brand`} />;
    if (action.includes('download'))
      return <IconDownload className={`${iconClass} text-text-brand`} />;
    if (action === 'quote.created')
      return <IconFileText className={`${iconClass} text-text-brand`} />;
    if (action === 'quote.submitted') return <IconSend className={`${iconClass} text-blue-500`} />;
    if (action === 'quote.approved') return <IconCheck className={`${iconClass} text-green-500`} />;
    if (action === 'quote.revision_requested')
      return <IconEdit className={`${iconClass} text-amber-500`} />;
    if (action === 'payment.proof_submitted')
      return <IconReceipt className={`${iconClass} text-blue-500`} />;
    if (action === 'payment.confirmed')
      return <IconCurrencyDollar className={`${iconClass} text-green-500`} />;
    return <IconUser className={`${iconClass} text-text-muted`} />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'user.signin': 'signed in',
      'user.signup': 'signed up',
      'quote.download': 'downloaded quote',
      'b2b_quote.download': 'downloaded B2B quote',
      'inventory.download': 'downloaded inventory',
      'quote.created': 'created quote',
      'quote.submitted': 'submitted quote',
      'quote.approved': 'approved quote',
      'quote.revision_requested': 'requested revision',
      'payment.proof_submitted': 'submitted payment proof',
      'payment.confirmed': 'confirmed payment',
    };
    return labels[action] || action;
  };

  const getActionBadgeColorRole = (action: string) => {
    if (action.includes('approved') || action.includes('confirmed')) return 'success' as const;
    if (action.includes('submitted') || action.includes('created')) return 'info' as const;
    if (action.includes('revision')) return 'warning' as const;
    if (action.includes('signin') || action.includes('signup')) return 'muted' as const;
    return 'muted' as const;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredActivities = activityData?.logs.filter((log) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.user?.email?.toLowerCase().includes(searchLower) ||
      log.user?.name?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower)
    );
  });

  // Group activities by date
  const groupedActivities = (() => {
    if (!filteredActivities) return null;
    const groups = new Map<string, (typeof filteredActivities)[number][]>();
    for (const log of filteredActivities) {
      const date = new Date(log.createdAt).toDateString();
      const existing = groups.get(date);
      if (existing) {
        existing.push(log);
      } else {
        groups.set(date, [log]);
      }
    }
    return groups;
  })();

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Typography variant="headingMd" className="mb-0.5">
            Activity Feed
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            {activityData?.total || 0} total activities
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <IconRefresh className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <IconFilter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters - Always visible on desktop, toggleable on mobile */}
      <Card className={`mb-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                type="search"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="user.signin">Sign Ins</SelectItem>
                <SelectItem value="user.signup">Signups</SelectItem>
                <SelectItem value="quote.created">Quote Created</SelectItem>
                <SelectItem value="quote.submitted">Quote Submitted</SelectItem>
                <SelectItem value="quote.approved">Quote Approved</SelectItem>
                <SelectItem value="quote.revision_requested">Revision Requested</SelectItem>
                <SelectItem value="payment.proof_submitted">Payment Proof</SelectItem>
                <SelectItem value="payment.confirmed">Payment Confirmed</SelectItem>
                <SelectItem value="quote.download">Downloads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border-primary">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          ) : groupedActivities && groupedActivities.size > 0 ? (
            <div className="divide-y divide-border-primary">
              {Array.from(groupedActivities.entries()).map(([date, logs]) =>
                logs.map((log, index) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-secondary/50"
                  >
                    {index === 0 ? (
                      <span className="w-16 shrink-0 text-xs font-medium text-text-muted">
                        {formatDateHeader(date)}
                      </span>
                    ) : (
                      <span className="w-16 shrink-0" />
                    )}

                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                      {getActivityIcon(log.action)}
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {log.user?.name || log.user?.email?.split('@')[0] || 'Unknown'}
                      </span>
                      <span className="text-sm text-text-muted">
                        {getActionLabel(log.action)}
                      </span>
                      <Badge
                        colorRole={getActionBadgeColorRole(log.action)}
                        size="xs"
                        className="hidden sm:inline-flex"
                      >
                        {log.action.split('.')[0]}
                      </Badge>
                    </div>

                    {log.metadata != null && (
                      <span className="hidden max-w-[150px] truncate text-xs text-text-muted lg:inline">
                        {(log.metadata as { quoteName?: string; clientName?: string })
                          .quoteName ||
                          (log.metadata as { quoteName?: string; clientName?: string })
                            .clientName ||
                          ''}
                      </span>
                    )}

                    <span className="shrink-0 text-xs text-text-muted">
                      {formatRelativeTime(new Date(log.createdAt))}
                    </span>
                  </div>
                )),
              )}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <IconUser className="mx-auto mb-2 h-6 w-6 text-text-muted" />
              <Typography variant="bodySm" className="text-text-muted">
                No activities found
              </Typography>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more hint */}
      {activityData && filteredActivities && filteredActivities.length < activityData.total && (
        <div className="mt-3 text-center">
          <Typography variant="bodyXs" className="text-text-muted">
            Showing {filteredActivities.length} of {activityData.total} activities
          </Typography>
        </div>
      )}
    </div>
  );
};

export default ActivityFeedPage;
