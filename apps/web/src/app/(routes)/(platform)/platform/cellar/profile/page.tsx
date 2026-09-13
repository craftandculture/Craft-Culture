'use client';

import {
  IconCheck,
  IconChevronLeft,
  IconFileText,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const ID_DOCUMENTS = [
  {
    type: 'emirates_id_front',
    label: 'Emirates ID — front',
  },
  {
    type: 'emirates_id_back',
    label: 'Emirates ID — back',
  },
] as const;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * A member's own account
 *
 * Everything here is something the member knows better than we do — where they
 * want wine delivered, how to get in, who they are for the licensed partner
 * who has to hand it over. Held on the account rather than asked for each
 * time.
 */
const CellarProfilePage = () => {
  const api = useTRPC();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: profile, isLoading, refetch } = useQuery({
    ...api.cellar.member.getProfile.queryOptions(),
  });

  const [form, setForm] = useState({
    phone: '',
    deliveryAddress: '',
    deliveryInstructions: '',
    eidNumber: '',
    eidExpiry: '',
  });
  const [isDirty, setIsDirty] = useState(false);

  /*
    Seeded once the account arrives, and not again while the member is typing
    — a refetch behind an open form that reset the fields would silently throw
    away what they had written.
  */
  useEffect(() => {
    if (!profile || isDirty) return;

    setForm({
      phone: profile.phone ?? '',
      deliveryAddress: profile.deliveryAddress ?? '',
      deliveryInstructions: profile.deliveryInstructions ?? '',
      eidNumber: profile.eidNumber ?? '',
      eidExpiry: profile.eidExpiry
        ? format(new Date(profile.eidExpiry), 'yyyy-MM-dd')
        : '',
    });
  }, [profile, isDirty]);

  const update = (key: keyof typeof form, value: string) => {
    setIsDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const { mutate: save, isPending: isSaving } = useMutation(
    api.cellar.member.saveProfile.mutationOptions({
      onSuccess: () => {
        toast.success('Saved');
        setIsDirty(false);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: upload } = useMutation(
    api.cellar.member.uploadIdentityDocument.mutationOptions({
      onSuccess: () => {
        toast.success('Uploaded');
        setUploading(null);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
        setUploading(null);
      },
    }),
  );

  const { mutate: remove } = useMutation(
    api.cellar.member.deleteIdentityDocument.mutationOptions({
      onSuccess: () => {
        toast.success('Removed');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const handleFile = (documentType: string, file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error('That file exceeds 10MB. A standard phone photograph is sufficient.');
      return;
    }

    setUploading(documentType);

    const reader = new FileReader();

    reader.onload = () =>
      upload({
        documentType: documentType as (typeof ID_DOCUMENTS)[number]['type'],
        file: String(reader.result),
        filename: file.name,
      });

    reader.onerror = () => {
      toast.error('That file could not be read');
      setUploading(null);
    };

    reader.readAsDataURL(file);
  };

  const documentFor = (type: string) =>
    profile?.documents.find((document) => document.documentType === type);

  /*
    An ID that expires in a month is still valid and still worth flagging, or
    the first anyone hears of it is a delivery being turned away.
  */
  const expiryWarning = (() => {
    if (!profile?.eidExpiry) return null;

    const days = Math.round(
      (new Date(profile.eidExpiry).getTime() - Date.now()) / 86_400_000,
    );

    if (days < 0) return 'Your Emirates ID has expired.';
    if (days <= 60) return `Your Emirates ID expires in ${days} days.`;
    return null;
  })();

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/platform/cellar"
        className="text-text-muted hover:text-text-primary mb-4 inline-flex items-center gap-1 text-xs font-medium transition-colors"
      >
        <Icon icon={IconChevronLeft} size="sm" />
        Your cellar
      </Link>

      <Typography
        variant="bodyXs"
        className="text-text-brand mb-1 block font-semibold uppercase tracking-wider"
      >
        C&amp;C Private Cellar
      </Typography>
      <Typography variant="headingLg">Your details</Typography>
      <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
        {profile?.name
          ? `Held against ${profile.name}`
          : 'Held against your membership'}
      </Typography>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted" className="mt-6 block">
          Loading...
        </Typography>
      )}

      {!isLoading && (
        <div className="mt-6 flex flex-col gap-5">
          <section className="border-border-muted rounded-xl border px-4 py-4">
            <Typography variant="bodySm" className="font-semibold">
              Delivery
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="mb-3 block">
              Where we deliver when you call wines forward. You can still send
              an individual delivery somewhere else.
            </Typography>

            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  Delivery address
                </span>
                <Input
                  value={form.deliveryAddress}
                  onChange={(event) =>
                    update('deliveryAddress', event.target.value)
                  }
                  placeholder="Villa or office, area, emirate"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                    Access instructions
                  </span>
                  <Input
                    value={form.deliveryInstructions}
                    onChange={(event) =>
                      update('deliveryInstructions', event.target.value)
                    }
                    placeholder="Gate code, who to ask for"
                  />
                </label>
                <label className="block">
                  <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                    Mobile
                  </span>
                  <Input
                    value={form.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    placeholder="+971"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="border-border-muted rounded-xl border px-4 py-4">
            <Typography variant="bodySm" className="font-semibold">
              Identification
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="mb-3 block">
              The licensed partner delivering on the mainland has to establish
              who is receiving the wine. Held once, used for every delivery.
            </Typography>

            {expiryWarning && (
              <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2">
                <Typography variant="bodyXs" className="text-amber-800">
                  {expiryWarning}
                </Typography>
              </div>
            )}

            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  Emirates ID number
                </span>
                <Input
                  value={form.eidNumber}
                  onChange={(event) => update('eidNumber', event.target.value)}
                  placeholder="784-XXXX-XXXXXXX-X"
                />
              </label>
              <label className="block">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  Expires
                </span>
                <input
                  type="date"
                  value={form.eidExpiry}
                  onChange={(event) => update('eidExpiry', event.target.value)}
                  className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-full rounded-lg border px-2.5 text-sm focus:outline-none"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              {ID_DOCUMENTS.map((document) => {
                const existing = documentFor(document.type);
                const isBusy = uploading === document.type;

                return (
                  <div
                    key={document.type}
                    className="border-border-muted flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon
                        icon={existing ? IconCheck : IconFileText}
                        size="sm"
                        className={
                          existing ? 'text-text-brand' : 'text-text-muted'
                        }
                      />
                      <div className="min-w-0">
                        <Typography variant="bodySm" className="font-medium">
                          {document.label}
                        </Typography>
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="block"
                        >
                          {existing
                            ? `${existing.fileName} · added ${format(
                                new Date(existing.uploadedAt),
                                'd MMM yyyy',
                              )}`
                            : 'Not uploaded'}
                        </Typography>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {existing && (
                        <>
                          <a
                            href={`/api/cellar/identity?type=${document.type}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-text-brand text-xs font-semibold hover:underline"
                          >
                            View
                          </a>
                          <button
                            type="button"
                            aria-label={`Remove ${document.label}`}
                            className="text-text-muted hover:text-text-primary p-1 transition-colors"
                            onClick={() =>
                              remove({ documentType: document.type })
                            }
                          >
                            <Icon icon={IconTrash} size="sm" />
                          </button>
                        </>
                      )}
                      <input
                        ref={(element) => {
                          inputRefs.current[document.type] = element;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(event) => {
                          handleFile(document.type, event.target.files?.[0]);
                          event.target.value = '';
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={isBusy}
                        onClick={() =>
                          inputRefs.current[document.type]?.click()
                        }
                      >
                        <ButtonContent iconLeft={IconUpload}>
                          {isBusy
                            ? 'Uploading'
                            : existing
                              ? 'Replace'
                              : 'Upload'}
                        </ButtonContent>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Typography variant="bodyXs" colorRole="muted" className="mt-2 block">
              Visible only to you and the Craft &amp; Culture team. A clear
              photograph from your phone is sufficient.
            </Typography>
          </section>

          <div className="flex items-center gap-3">
            <Button
              isDisabled={isSaving || !isDirty}
              onClick={() =>
                save({
                  phone: form.phone || null,
                  deliveryAddress: form.deliveryAddress || null,
                  deliveryInstructions: form.deliveryInstructions || null,
                  eidNumber: form.eidNumber || null,
                  eidExpiry: form.eidExpiry || null,
                })
              }
            >
              <ButtonContent>
                {isSaving ? 'Saving' : 'Save details'}
              </ButtonContent>
            </Button>
            {isDirty && (
              <Typography variant="bodyXs" colorRole="muted">
                Unsaved changes
              </Typography>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CellarProfilePage;
