'use client';

import { IconLock, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import FieldLabel from './FieldLabel';
import IdSideCapture from './IdSideCapture';
import fieldClass from '../constants/fieldClass';
import fileToUploadDataUrl from '../utils/fileToUploadDataUrl';

export type ActivationAction = 'purchase' | 'release' | 'offer_for_sale' | 'transfer_in' | 'other';

export interface ActivationSheetProps {
  action: ActivationAction;
  /** The cellar page to come back to after Zoho's payment page */
  returnTo: string;
  onClose: () => void;
}

type Side = 'emirates_id_front' | 'emirates_id_back';

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

/**
 * "Activate your cellar" — shown in place the first time a member acts
 *
 * Two steps, each only if needed: the Emirates ID, then the card on Zoho's
 * payment page. The monthly membership starts when the card goes through.
 */
const ActivationSheet = ({ action, returnTo, onClose }: ActivationSheetProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const activationQuery = api.onboarding.member.activation.queryOptions();
  const { data } = useQuery(activationQuery);

  const [eid, setEid] = useState({ eidNumber: '', eidExpiry: '' });
  const [uploading, setUploading] = useState<Side | null>(null);
  const [justUploaded, setUploaded] = useState<Side[]>([]);

  const saveStep = useMutation(api.onboarding.application.saveStep.mutationOptions());
  const upload = useMutation(api.onboarding.application.uploadIdentity.mutationOptions());
  const start = useMutation(api.onboarding.member.startActivation.mutationOptions());

  if (!data) return null;

  const needsIdentity = data.missing.includes('identity');
  const uploaded = [
    ...justUploaded,
    ...data.documentTypes.filter((type): type is Side => type === 'emirates_id_front' || type === 'emirates_id_back'),
  ];
  const eidNumber = eid.eidNumber || data.eidNumber || '';
  const refresh = () => queryClient.invalidateQueries({ queryKey: activationQuery.queryKey });

  const uploadSide = async (side: Side, file: File) => {
    setUploading(side);
    try {
      const { dataUrl, filename } = await fileToUploadDataUrl(file);
      const view = await upload.mutateAsync({ documentType: side, file: dataUrl, filename });
      setUploaded(view.documentTypes.filter((type): type is Side => type.startsWith('emirates_id')));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload');
    } finally {
      setUploading(null);
    }
  };

  const saveIdentity = async () => {
    try {
      await saveStep.mutateAsync({
        step: 'identity',
        next: 'membership',
        eidNumber,
        eidExpiry: eid.eidExpiry || undefined,
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    }
  };

  const addCard = async () => {
    try {
      const result = await start.mutateAsync({ action, returnTo });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      toast.success('Your cellar is active');
      await refresh();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the payment page');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog">
      <div className="bg-surface-primary max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-text-primary text-xl font-semibold tracking-tight">Activate your cellar</h2>
            <p className="text-text-muted mt-1 text-sm leading-6">
              {needsIdentity
                ? 'Two quick steps before your first request: your Emirates ID, then your membership.'
                : 'One step: start your membership, and your request goes ahead.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted">
            <IconX size={20} />
          </button>
        </div>

        {needsIdentity ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Emirates ID number">
                <input
                  className={`${fieldClass} h-11`}
                  inputMode="numeric"
                  value={eidNumber}
                  onChange={(event) => setEid((current) => ({ ...current, eidNumber: event.target.value }))}
                  placeholder="784-0000-0000000-0"
                />
              </FieldLabel>
              <FieldLabel label="Expiry date">
                <input
                  type="date"
                  className={`${fieldClass} h-11`}
                  value={eid.eidExpiry}
                  onChange={(event) => setEid((current) => ({ ...current, eidExpiry: event.target.value }))}
                />
              </FieldLabel>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['emirates_id_front', 'emirates_id_back'] as const).map((side) => (
                <IdSideCapture
                  key={side}
                  label={side === 'emirates_id_front' ? 'Front' : 'Back'}
                  isUploaded={uploaded.includes(side)}
                  isUploading={uploading === side}
                  onFile={(file) => void uploadSide(side, file)}
                />
              ))}
            </div>
            <p className="text-text-muted flex items-center gap-2 text-xs">
              <IconLock size={14} /> Encrypted when stored, seen only by our team and you.
            </p>
            <button
              type="button"
              onClick={() => void saveIdentity()}
              disabled={saveStep.isPending || !eidNumber.trim() || new Set(uploaded).size < 2}
              className="bg-text-primary text-surface-primary h-11 w-full rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              {saveStep.isPending ? 'Saving…' : 'Continue'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="border-border-muted divide-border-muted divide-y rounded-xl border text-sm">
              {[
                ['Membership', `${aed(data.terms.membershipFeeAed)} a month`],
                ['Included', `Up to ${data.terms.includedCases} cases`],
                ['Above that', `${aed(data.terms.extraCaseMonthlyAed)} per case, per month`],
                ['VAT', 'None — free zone'],
                ['Commitment', "Monthly, 30 days' notice"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="text-text-primary text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-text-muted text-xs leading-5">
              Your card is taken on our billing provider&apos;s secure page. Membership starts today; wine you buy is
              still paid by bank transfer.
            </p>
            <button
              type="button"
              onClick={() => void addCard()}
              disabled={start.isPending}
              className="bg-text-primary text-surface-primary h-11 w-full rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              {start.isPending ? 'Opening…' : 'Add card and start membership'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivationSheet;
