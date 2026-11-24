'use client';

import { IconCopy, IconExternalLink, IconKey, IconLock } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { OWN_STOCK_PERMISSION } from '@/app/_partners/schemas/createApiKeySchema';
import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import AlertDialogTrigger from '@/app/_ui/components/AlertDialog/AlertDialogTrigger';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface WinePartnerApiKeysProps {
  partnerId: string;
  partnerName: string;
  apiKeys: { id: string; name: string; keyPrefix: string; createdAt: Date | string }[];
  onChanged: () => void;
}

/**
 * Stock API keys for one wine partner
 *
 * Keys issued here carry only `read:own_stock`: the partner's own stock,
 * movements, sales and reservations. The catalogue feed is a distributor
 * integration, issued from the Distributors screen, so a wine partner's key
 * cannot read it. The key is shown once, at creation.
 */
const WinePartnerApiKeys = ({ partnerId, partnerName, apiKeys, onChanged }: WinePartnerApiKeysProps) => {
  const api = useTRPC();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: createKey, isPending: isCreating } = useMutation(
    api.partners.apiKeys.create.mutationOptions({
      onSuccess: (data) => {
        setGeneratedKey(data.key);
        onChanged();
      },
    }),
  );

  const { mutate: revokeKey, isPending: isRevoking } = useMutation(
    api.partners.apiKeys.revoke.mutationOptions({ onSuccess: () => onChanged() }),
  );

  const openDialog = () => {
    setName(`${partnerName} stock integration`);
    setGeneratedKey(null);
    setCopied(false);
    setIsOpen(true);
  };

  return (
    <div className="border-border-muted mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Typography variant="bodySm" className="font-medium">
            Stock API ({apiKeys.length} {apiKeys.length === 1 ? 'key' : 'keys'})
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Lets the partner&apos;s own system read their stock, movements, sales and reservations.
          </Typography>
        </div>
        <div className="flex gap-2">
          <Link href="/docs/stock-api" target="_blank">
            <Button size="sm" variant="ghost">
              <ButtonContent iconRight={IconExternalLink}>Docs</ButtonContent>
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={openDialog}>
            <ButtonContent iconLeft={IconKey}>Generate key</ButtonContent>
          </Button>
        </div>
      </div>

      {apiKeys.length > 0 && (
        <div className="mt-3 space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="bg-fill-muted flex items-center justify-between rounded-md px-3 py-2"
            >
              <div>
                <Typography variant="bodySm">{key.name}</Typography>
                <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                  {key.keyPrefix}… · issued {new Date(key.createdAt).toLocaleDateString('en-GB')}
                </Typography>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" colorRole="danger" isDisabled={isRevoking} title="Revoke key">
                    <ButtonContent iconLeft={IconLock}>Revoke</ButtonContent>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {partnerName}&apos;s integration using &quot;{key.name}&quot; stops working
                      immediately. Issue a new key if they still need access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => revokeKey({ apiKeyId: key.id })}>
                      Revoke key
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{generatedKey ? 'Key issued' : 'Issue a Stock API key'}</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? 'Copy it now. It is shown only once and cannot be retrieved later.'
                : `${partnerName} will be able to read their own stock, movements, sales and reservations. Nothing else, and no other partner's wine.`}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="bg-fill-muted flex items-center gap-2 rounded-lg p-3">
                <code className="flex-1 break-all font-mono text-sm">{generatedKey}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(generatedKey);
                    setCopied(true);
                  }}
                >
                  <ButtonContent iconLeft={IconCopy}>{copied ? 'Copied' : 'Copy'}</ButtonContent>
                </Button>
              </div>
              <Typography variant="bodyXs" colorRole="muted">
                Send the key to the partner&apos;s technical contact through a secure channel, with
                the documentation link: https://wine.craftculture.xyz/docs/stock-api
              </Typography>
              <div className="flex justify-end">
                <Button variant="default" onClick={() => setIsOpen(false)}>
                  <ButtonContent>Done</ButtonContent>
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createKey({ partnerId, name, permissions: [OWN_STOCK_PERMISSION] });
              }}
            >
              <div>
                <label className="text-text-primary mb-1 block text-sm font-medium">Key name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="border-border-primary bg-background-primary w-full rounded-lg border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  <ButtonContent>Cancel</ButtonContent>
                </Button>
                <Button type="submit" variant="default" isDisabled={isCreating || !name.trim()}>
                  <ButtonContent iconLeft={IconKey}>
                    {isCreating ? 'Issuing…' : 'Issue key'}
                  </ButtonContent>
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WinePartnerApiKeys;
