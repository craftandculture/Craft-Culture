'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import useTRPC from '@/lib/trpc/browser';

import fieldClass from '../../constants/fieldClass';
import fileToUploadDataUrl from '../../utils/fileToUploadDataUrl';
import FieldLabel from '../FieldLabel';

export interface ApplicationEditFormProps {
  applicationId: string;
  initial: {
    fullName: string;
    phone: string;
    deliveryAddress: string;
    eidNumber: string;
    eidExpiry: string;
  };
  onDone: () => void;
}

type Side = 'emirates_id_front' | 'emirates_id_back';

/**
 * Fill in an applicant's details from what they sent on WhatsApp
 *
 * Text fields save together; each ID photo uploads on its own as soon as it
 * is chosen, encrypted like the applicant's own.
 */
const ApplicationEditForm = ({ applicationId, initial, onDone }: ApplicationEditFormProps) => {
  const api = useTRPC();
  const [values, setValues] = useState(initial);
  const [uploading, setUploading] = useState<Side | null>(null);

  const update = useMutation(api.onboarding.admin.updateApplication.mutationOptions());
  const upload = useMutation(api.onboarding.admin.uploadApplicationIdentity.mutationOptions());

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    try {
      await update.mutateAsync({ applicationId, ...values, eidExpiry: values.eidExpiry || null });
      toast.success('Details saved');
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    }
  };

  const uploadSide = async (side: Side, file: File | undefined) => {
    if (!file) return;
    setUploading(side);
    try {
      const { dataUrl, filename } = await fileToUploadDataUrl(file);
      await upload.mutateAsync({ applicationId, documentType: side, file: dataUrl, filename });
      toast.success(side === 'emirates_id_front' ? 'Front added' : 'Back added');
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="border-border-muted space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Full name">
          <input className={`${fieldClass} h-10 text-sm`} value={values.fullName} onChange={set('fullName')} />
        </FieldLabel>
        <FieldLabel label="Mobile">
          <input className={`${fieldClass} h-10 text-sm`} value={values.phone} onChange={set('phone')} />
        </FieldLabel>
        <FieldLabel label="Emirates ID number">
          <input className={`${fieldClass} h-10 text-sm`} value={values.eidNumber} onChange={set('eidNumber')} />
        </FieldLabel>
        <FieldLabel label="ID expiry">
          <input type="date" className={`${fieldClass} h-10 text-sm`} value={values.eidExpiry} onChange={set('eidExpiry')} />
        </FieldLabel>
      </div>
      <FieldLabel label="UAE delivery address">
        <textarea className={`${fieldClass} min-h-16 py-2 text-sm`} value={values.deliveryAddress} onChange={set('deliveryAddress')} />
      </FieldLabel>
      <div className="flex flex-wrap gap-4 text-sm">
        {(['emirates_id_front', 'emirates_id_back'] as const).map((side) => (
          <label key={side} className="text-text-primary underline-offset-2 cursor-pointer font-semibold">
            {uploading === side ? 'Uploading…' : side === 'emirates_id_front' ? 'Add ID front' : 'Add ID back'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={uploading !== null}
              onChange={(event) => void uploadSide(side, event.target.files?.[0])}
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          colorRole="bold"
          onClick={() => void save()}
          isDisabled={update.isPending || values.fullName.trim().length < 2}
        >
          <ButtonContent isLoading={update.isPending}>Save details</ButtonContent>
        </Button>
      </div>
    </div>
  );
};

export default ApplicationEditForm;
