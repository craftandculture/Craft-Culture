'use client';

import { IconDownload, IconLogin, IconUser, IconUserPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import markActivitiesAsViewed from '@/app/_admin/actions/markActivitiesAsViewed';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
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

  // Mark activities as viewed when page opens
  useEffect(() => {
    void markActivitiesAsViewed();
  }, []);

  const { data: activityData, isLoading } = useQuery({
    ...api.admin.userActivityLogs.getMany.queryOptions({
      limit: 50,
      offset: 0,
      action: actionFilter !== 'all' ? actionFilter : undefined,
    }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getActivityIcon = (action: string) => {
    if (action.includes('signin')) return <IconLogin className="h-5 w-5 text-blue-600" />;
    if (action.includes('signup')) return <IconUserPlus className="h-5 w-5 text-green-600" />;
    if (action.includes('download')) return <IconDownload className="h-5 w-5 text-purple-600" />;
    return <IconUser className="h-5 w-5 text-gray-600" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'user.signin': 'User Sign In',
      'user.signup': 'New User Signup',
      'quote.download': 'Quote Downloaded',
      'b2b_quote.download': 'B2B Quote Downloaded',
      'inventory.download': 'Inventory Downloaded',
    };
    return labels[action] || action;
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

  return (
    <main className="container py-8 md:py-16">
      <Card className="mx-auto w-full max-w-7xl">
        <CardContent>
          <CardProse>
            <CardTitle>User Activity Feed</CardTitle>
            <CardDescription colorRole="muted">
              Real-time monitoring of all user activities across the platform
            </CardDescription>
          </CardProse>

          {/* Filters */}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Input
                type="search"
                placeholder="Search by user email or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="user.signin">Sign Ins</SelectItem>
                  <SelectItem value="user.signup">Signups</SelectItem>
                  <SelectItem value="quote.download">Quote Downloads</SelectItem>
                  <SelectItem value="b2b_quote.download">B2B Downloads</SelectItem>
                  <SelectItem value="inventory.download">Inventory Downloads</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Activity List */}
          <div className="mt-6 space-y-3">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-surface-secondary rounded-lg border p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredActivities && filteredActivities.length > 0 ? (
              filteredActivities.map((log) => (
                <div
                  key={log.id}
                  className="bg-surface-secondary hover:bg-surface-tertiary rounded-lg border p-4 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                      {getActivityIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Typography variant="bodySm" className="font-semibold">
                            {log.user?.name || 'Unknown User'}
                          </Typography>
                          <Typography variant="bodyXs" className="text-text-muted">
                            {log.user?.email}
                          </Typography>
                        </div>
                        <Typography variant="bodyXs" className="text-text-muted whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </Typography>
                      </div>
                      <div className="mt-2">
                        <Typography variant="bodySm" className="text-text-secondary">
                          {getActionLabel(log.action)}
                        </Typography>
                        {log.metadata ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {Object.entries(log.metadata as Record<string, unknown>).map(
                              ([key, value]) => (
                                <span
                                  key={key}
                                  className="bg-surface-primary text-text-muted rounded px-2 py-0.5 text-xs"
                                >
                                  {key}: {String(value)}
                                </span>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
                      {log.ipAddress && (
                        <Typography variant="bodyXs" className="text-text-muted mt-1">
                          IP: {log.ipAddress}
                        </Typography>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-surface-secondary rounded-lg border p-8 text-center">
                <Typography variant="bodySm" className="text-text-muted">
                  No activities found matching your filters
                </Typography>
              </div>
            )}
          </div>

          {/* Total count */}
          {activityData && (
            <div className="mt-4 text-center">
              <Typography variant="bodyXs" className="text-text-muted">
                Showing {filteredActivities?.length || 0} of {activityData.total} total activities
              </Typography>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ActivityFeedPage;
