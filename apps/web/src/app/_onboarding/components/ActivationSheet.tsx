'use client';

import { IconCheck, IconLock, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import FieldLabel from './FieldLabel';
import IdSideCapture from './IdSideCapture';
import fieldClass from '../constants/fieldClass';
import { PRIVATE_CELLAR_TERMS_PATH } from '../constants/privateCellarTerms';
import fileToUploadDataUrl from '../utils/fileToUploadDataUrl';

export type ActivationAction = 'purchase' | 'release' | 'offer_for_sale' | 'transfer_in' | 'other';

export interface ActivationSheetProps {
  action: ActivationAction;
  /** The cellar page to come back to after Zoho's payment page */
  returnTo: string;
  onClose: () => void;
}

type Side = 'emirates_id_front' | 'emirates_id_back';

/** What happens once they confirm, in the words of what they were doing */
const ACTION_OUTCOME: Record<ActivationAction, string> = {
  purchase: 'Your wine is reserved',
  release: 'Your release request goes ahead',
  offer_for_sale: 'Your wine is offered for sale',
  transfer_in: 'We start arranging your transfer',
  other: 'Your request goes ahead',
};

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

/**
 * "Activate your cellar" — shown in place the first time a member acts
 *
 * Two steps, each only if needed: the Emirates ID, then the membership —
 * started at once when billed by invoice, or on Zoho's card page when billed
 * by card. The monthly membership starts at that point.
 */
const ActivationSheet = ({ action, returnTo, onClose }: ActivationSheetProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const activationQuery = api.onboarding.member.activation.queryOptions();
  const { data } = useQuery(activationQuery);

  const [eid, setEid] = useState({ eidNumber: '', eidExpiry: '' });
  const [uploading, setUploading] = useState<Side | null>(null);
  const [justUploaded, setUploaded] = useState<Side[]>([]);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [hadIdentityStep, setHadIdentityStep] = useState(false);

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
      setHadIdentityStep(true);
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
      toast.error(error instanceof Error ? error.message : 'Could not start your membership');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog">
      <div className="bg-surface-primary max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">
              {needsIdentity ? 'Step 1 of 2 · Your Emirates ID' : `Step ${hadIdentityStep ? '2 of 2' : '1 of 1'} · Membership`}
            </p>
            <h2 className="text-text-primary mt-1 text-xl font-semibold tracking-tight">
              {needsIdentity ? 'Verify your identity' : 'Start your membership'}
            </h2>
            <p className="text-text-muted mt-1 text-sm leading-6">
              {needsIdentity
                ? 'We are required to verify every member before wine moves in or out of bond. You only do this once.'
                : `${ACTION_OUTCOME[action]} as soon as you confirm.`}
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
              <IconLock size={14} /> Encrypted when stored, and seen only by our team and you.
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
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-transparent p-4 dark:border-slate-700 dark:from-slate-500/10">
              <p className="text-text-primary text-3xl font-bold tracking-tight tabular-nums">
                {aed(data.terms.membershipFeeAed)}
                <span className="text-text-muted text-base font-medium"> / month</span>
              </p>
              <p className="text-text-muted mt-1 text-sm">
                Includes storage for {data.terms.includedCases * 12} bottles ({data.terms.includedCases} cases of 12)
              </p>
            </div>

            <ul className="space-y-2.5 text-sm">
              {[
                `Beyond that, ${aed(data.terms.extraCaseMonthlyAed)} a month per case of 12, or ${aed(
                  data.terms.extraCaseMonthlyAed / 2,
                )} per case of 6`,
                data.billingMode === 'invoice'
                  ? 'Invoiced monthly, payable by bank transfer. Wine you buy is invoiced separately.'
                  : 'Charged monthly to your card. Wine you buy is paid by bank transfer.',
                "No minimum term: end your membership at any time with 30 days' notice",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/20">
                    <IconCheck size={12} stroke={3} />
                  </span>
                  <span className="text-text-primary leading-6">{point}</span>
                </li>
              ))}
            </ul>

            <label className="border-border-muted flex cursor-pointer items-start gap-3 rounded-xl border p-3.5">
              <input
                type="checkbox"
                checked={hasAccepted}
                onChange={(event) => setHasAccepted(event.target.checked)}
                className="mt-0.5 size-4 flex-shrink-0 accent-current"
              />
              <span className="text-text-muted text-xs leading-5">
                I accept the{' '}
                <a
                  href={PRIVATE_CELLAR_TERMS_PATH}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-primary font-semibold underline underline-offset-2"
                >
                  membership terms
                </a>{' '}
                and the monthly fee and storage charges above, which continue until my membership ends. Prices
                exclude VAT, which is added only where it applies.
              </span>
            </label>

            <button
              type="button"
              onClick={() => void addCard()}
              disabled={start.isPending || !hasAccepted}
              className="bg-text-primary text-surface-primary h-12 w-full rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            >
              {start.isPending
                ? data.billingMode === 'invoice'
                  ? 'Starting…'
                  : 'Opening…'
                : data.billingMode === 'invoice'
                  ? 'Start membership'
                  : 'Add card and start membership'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivationSheet;
