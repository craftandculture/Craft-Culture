'use client';

import { IconBell, IconLock } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Switch from '@/app/_ui/components/Switch/Switch';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Notification preferences section for user settings
 *
 * Allows users to enable/disable specific notification types
 */
const NotificationPreferencesSection = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);

  // Fetch notification preferences
  const { data, isLoading } = useQuery({
    ...api.settings.getNotificationPreferences.queryOptions(),
  });

  // Update mutation
  const updateMutation = useMutation(
    api.settings.updateNotificationPreferences.mutationOptions({
      onSuccess: () => {
        toast.success('Notification preferences saved');
        setPendingChanges({});
        void queryClient.invalidateQueries({
          queryKey: api.settings.getNotificationPreferences.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(`Failed to save preferences: ${error.message}`);
      },
      onSettled: () => {
        setIsSaving(false);
      },
    }),
  );

  // Calculate current state including pending changes
  const currentState = useMemo(() => {
    if (!data?.categories) return {};

    const state: Record<string, boolean> = {};
    for (const category of data.categories) {
      for (const type of category.types) {
        // Use pending change if exists, otherwise use server state
        state[type.type] =
          pendingChanges[type.type] ?? type.enabled;
      }
    }
    return state;
  }, [data?.categories, pendingChanges]);

  const handleToggle = (notificationType: string, enabled: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      [notificationType]: enabled,
    }));
  };

  const handleSave = () => {
    // Calculate disabled types from current state
    const disabledTypes = Object.entries(currentState)
      .filter(([, enabled]) => !enabled)
      .map(([type]) => type);

    setIsSaving(true);
    updateMutation.mutate({ disabledTypes });
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6">
        <div className="flex items-center gap-2">
          <Icon icon={IconBell} size="sm" colorRole="muted" />
          <Typography variant="bodyLg" className="font-semibold">
            Notification Preferences
          </Typography>
        </div>
        <div className="flex items-center justify-center py-8">
          <Typography variant="bodyXs" colorRole="muted">
            Loading preferences...
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon={IconBell} size="sm" colorRole="muted" />
          <Typography variant="bodyLg" className="font-semibold">
            Notification Preferences
          </Typography>
        </div>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} isDisabled={isSaving}>
            <ButtonContent isLoading={isSaving}>Save changes</ButtonContent>
          </Button>
        )}
      </div>

      <Typography variant="bodyXs" colorRole="muted">
        Choose which notifications you want to receive. Some notifications may
        be managed by your administrator.
      </Typography>

      {/* Categories */}
      <div className="space-y-4">
        {data?.categories.map((category) => (
          <div
            key={category.id}
            className="rounded-lg border border-border-secondary bg-surface-secondary p-4"
          >
            <Typography variant="bodySm" className="mb-3 font-medium">
              {category.label}
            </Typography>

            <div className="space-y-3">
              {category.types.map((type) => {
                const isEnabled = currentState[type.type] ?? true;
                const isAdminDisabled = type.adminDisabled;

                return (
                  <div
                    key={type.type}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodySm">{type.label}</Typography>
                        {isAdminDisabled && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Icon
                                icon={IconLock}
                                size="xs"
                                colorRole="muted"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <Typography variant="bodyXs">
                                Disabled by administrator
                              </Typography>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <Typography variant="bodyXs" colorRole="muted">
                        {type.description}
                      </Typography>
                    </div>
                    <Switch
                      size="sm"
                      checked={isEnabled && !isAdminDisabled}
                      onCheckedChange={(checked) =>
                        handleToggle(type.type, checked)
                      }
                      disabled={isAdminDisabled}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationPreferencesSection;
