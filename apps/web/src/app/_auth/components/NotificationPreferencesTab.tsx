'use client';

import { IconBell, IconLock, IconUser } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Switch from '@/app/_ui/components/Switch/Switch';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface NotificationPreferencesTabProps {
  userId: string;
}

/**
 * Admin tab for managing user notification preferences
 *
 * Shows user's preferences (read-only) and allows admin to override
 */
const NotificationPreferencesTab = ({
  userId,
}: NotificationPreferencesTabProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);

  // Fetch notification preferences
  const { data, isLoading } = useQuery({
    ...api.users.adminGetNotificationPreferences.queryOptions({ userId }),
  });

  // Update mutation
  const updateMutation = useMutation(
    api.users.adminUpdateNotificationPreferences.mutationOptions({
      onSuccess: () => {
        toast.success('Notification settings saved');
        setPendingChanges({});
        void queryClient.invalidateQueries({
          queryKey: api.users.adminGetNotificationPreferences.queryKey({
            userId,
          }),
        });
      },
      onError: (error) => {
        toast.error(`Failed to save settings: ${error.message}`);
      },
      onSettled: () => {
        setIsSaving(false);
      },
    }),
  );

  // Calculate current admin-disabled state including pending changes
  const currentAdminDisabled = useMemo(() => {
    if (!data?.categories) return {};

    const state: Record<string, boolean> = {};
    for (const category of data.categories) {
      for (const type of category.types) {
        // Use pending change if exists, otherwise use server state
        state[type.type] =
          pendingChanges[type.type] ?? type.adminDisabled;
      }
    }
    return state;
  }, [data?.categories, pendingChanges]);

  const handleToggle = (notificationType: string, adminDisabled: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      [notificationType]: adminDisabled,
    }));
  };

  const handleSave = () => {
    // Calculate admin-disabled types from current state
    const adminDisabledTypes = Object.entries(currentAdminDisabled)
      .filter(([, disabled]) => disabled)
      .map(([type]) => type);

    setIsSaving(true);
    updateMutation.mutate({ userId, adminDisabledTypes });
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Typography variant="bodyXs" colorRole="muted">
          Loading notification preferences...
        </Typography>
      </div>
    );
  }

  if (!data) {
    return (
      <Typography variant="bodySm" colorRole="muted">
        Could not load notification preferences
      </Typography>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="headingSm">Notification Settings</Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Control which notifications this user receives
          </Typography>
        </div>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} isDisabled={isSaving}>
            <ButtonContent isLoading={isSaving}>Save changes</ButtonContent>
          </Button>
        )}
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icon icon={IconUser} size="sm" colorRole="muted" />
              <Typography variant="bodySm">
                User disabled: {data.summary.userDisabledCount} notification
                {data.summary.userDisabledCount !== 1 ? 's' : ''}
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <Icon icon={IconLock} size="sm" colorRole="muted" />
              <Typography variant="bodySm">
                Admin disabled: {data.summary.adminDisabledCount} notification
                {data.summary.adminDisabledCount !== 1 ? 's' : ''}
              </Typography>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="grid gap-4 md:grid-cols-2">
        {data.categories.map((category) => (
          <Card key={category.id}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Icon icon={IconBell} size="sm" colorRole="brand" />
                <Typography variant="bodySm" className="font-medium">
                  {category.label}
                </Typography>
              </div>

              <div className="space-y-3">
                {category.types.map((type) => {
                  const isAdminDisabled =
                    currentAdminDisabled[type.type] ?? false;
                  const isUserDisabled = !type.userEnabled;

                  return (
                    <div
                      key={type.type}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Typography variant="bodyXs" className="font-medium">
                            {type.label}
                          </Typography>
                          {isUserDisabled && !isAdminDisabled && (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  User OFF
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <Typography variant="bodyXs">
                                  User has disabled this notification
                                </Typography>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="text-[11px]"
                        >
                          {type.description}
                        </Typography>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <Switch
                                size="sm"
                                checked={!isAdminDisabled}
                                onCheckedChange={(checked) =>
                                  handleToggle(type.type, !checked)
                                }
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <Typography variant="bodyXs">
                              {isAdminDisabled
                                ? 'Click to allow this notification'
                                : 'Click to block this notification for user'}
                            </Typography>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NotificationPreferencesTab;
