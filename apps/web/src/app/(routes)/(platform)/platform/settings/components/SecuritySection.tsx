'use client';

import {
  IconDeviceLaptop,
  IconDeviceMobile,
  IconFingerprint,
  IconPlus,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import authBrowserClient from '@/lib/better-auth/browser';
import features from '@/lib/features';
import { useTRPCClient } from '@/lib/trpc/browser';

interface Passkey {
  id: string;
  name: string | null;
  credentialID: string;
  deviceType: string;
  createdAt: Date;
}

/**
 * Get a friendly name for the current device
 */
const getDeviceName = () => {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Device';
};

/**
 * Security section for managing passkeys and authentication methods
 */
const SecuritySection = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [supportsPasskey, setSupportsPasskey] = useState(false);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);

  // Check if browser supports WebAuthn
  useEffect(() => {
    const checkPasskeySupport = async () => {
      if (
        features.passkeys &&
        typeof window !== 'undefined' &&
        window.PublicKeyCredential
      ) {
        try {
          const available =
            await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setSupportsPasskey(available);
        } catch {
          setSupportsPasskey(false);
        }
      }
    };
    void checkPasskeySupport();
  }, []);

  // Fetch user's passkeys
  const { data: passkeys, isLoading: isLoadingPasskeys } = useQuery({
    queryKey: ['passkeys.list'],
    queryFn: () => trpcClient.passkeys.list.query(),
    enabled: features.passkeys,
  });

  // Delete passkey mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.passkeys.delete.mutate({ id }),
    onSuccess: () => {
      toast.success('Passkey removed successfully');
      void queryClient.invalidateQueries({ queryKey: ['passkeys.list'] });
    },
    onError: (error) => {
      toast.error(`Failed to remove passkey: ${error.message}`);
    },
  });

  const handleAddPasskey = async () => {
    setIsAddingPasskey(true);
    try {
      const response = await authBrowserClient.passkey.addPasskey({
        name: getDeviceName(),
      });

      if (!response || 'error' in response) {
        // Log full error for debugging
        console.error('[Passkey] Add passkey failed:', {
          response,
          error: response && 'error' in response ? response.error : 'No response',
        });
        const errorMessage =
          response && 'error' in response && response.error
            ? response.error.message
            : 'Failed to add passkey';
        toast.error(errorMessage || 'Failed to add passkey');
        return;
      }

      toast.success('Passkey added successfully');
      void queryClient.invalidateQueries({ queryKey: ['passkeys.list'] });
    } catch {
      toast.error('Failed to add passkey. Please try again.');
    } finally {
      setIsAddingPasskey(false);
    }
  };

  const handleDeletePasskey = (id: string) => {
    if (
      window.confirm(
        'Are you sure you want to remove this passkey? You will no longer be able to sign in with it.',
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  // Don't render if passkeys feature is disabled
  if (!features.passkeys) {
    return null;
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Icon icon={IconShieldCheck} size="sm" colorRole="muted" />
        <Typography variant="bodyLg" className="font-semibold">
          Security
        </Typography>
      </div>

      {/* Passkeys Subsection */}
      <div className="rounded-lg border border-border-secondary bg-surface-secondary p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon={IconFingerprint} size="sm" colorRole="brand" />
            <Typography variant="bodySm" className="font-medium">
              Passkeys
            </Typography>
          </div>
          {supportsPasskey && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddPasskey}
              isDisabled={isAddingPasskey}
            >
              <ButtonContent iconLeft={IconPlus} isLoading={isAddingPasskey}>
                Add passkey
              </ButtonContent>
            </Button>
          )}
        </div>

        <Typography variant="bodyXs" colorRole="muted" className="mb-4">
          Passkeys let you sign in securely using your device&apos;s biometrics
          (fingerprint, face) or screen lock. They&apos;re more secure than
          passwords and can&apos;t be phished.
        </Typography>

        {/* Passkey List */}
        {isLoadingPasskeys ? (
          <div className="flex items-center justify-center py-4">
            <Typography variant="bodyXs" colorRole="muted">
              Loading passkeys...
            </Typography>
          </div>
        ) : passkeys && passkeys.length > 0 ? (
          <div className="space-y-2">
            {passkeys.map((passkey: Passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between rounded-md border border-border-tertiary bg-surface-primary p-3"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    icon={
                      passkey.deviceType === 'platform'
                        ? IconDeviceMobile
                        : IconDeviceLaptop
                    }
                    size="sm"
                    colorRole="muted"
                  />
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {passkey.name || 'Passkey'}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Added{' '}
                      {new Date(passkey.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Typography>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  colorRole="danger"
                  onClick={() => handleDeletePasskey(passkey.id)}
                  isDisabled={deleteMutation.isPending}
                >
                  <ButtonContent iconLeft={IconTrash}>Remove</ButtonContent>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border-tertiary bg-surface-primary p-4 text-center">
            <Typography variant="bodyXs" colorRole="muted">
              {supportsPasskey
                ? 'No passkeys registered yet. Add one to enable passwordless sign-in.'
                : 'Your browser or device does not support passkeys.'}
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecuritySection;
