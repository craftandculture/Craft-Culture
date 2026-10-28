'use client';

import {
  IconCheck,
  IconFileText,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import CellarAccessPanel from '@/app/_cellar/components/CellarAccessPanel';
import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import CellarState from '@/app/_cellar/components/CellarState';
import DeliveryAddressBook from '@/app/_cellar/components/DeliveryAddressBook';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import CellarInstallCard from '../CellarInstallCard';
import CellarPasskeyCard from '../CellarPasskeyCard';

const ID_DOCUMENTS = [
  {
    type: 'emirates_id_front',
    label: 'Emirates ID (front)',
  },
  {
    type: 'emirates_id_back',
    label: 'Emirates ID (back)',
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
  const queryClient = useQueryClient();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  /* Removing an identity document asks once before it goes */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const { data: profile, isLoading, isError, refetch } = useQuery({
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
        toast.success('Your details have been saved.');
        setIsDirty(false);
        void refetch();
        /* The main address in the saved list follows what was just saved */
        void queryClient.invalidateQueries({
          queryKey: api.cellar.member.getAddresses.queryKey(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: upload } = useMutation(
    api.cellar.member.uploadIdentityDocument.mutationOptions({
      onSuccess: () => {
        toast.success('Document uploaded.');
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
        toast.success('Document removed.');
        setConfirmRemove(null);
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

  const isDelegate = Boolean(profile && profile.cellarRole !== 'holder');

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
    <div className="w-full pb-8">
      <CellarPageHeader
        title={
          isDelegate
            ? profile?.name
              ? `${profile.name}’s private cellar`
              : 'Shared private cellar'
            : 'Your details'
        }
        description={
          profile?.reference ? (
            <>
              Your cellar reference:{' '}
              <span className="text-text-primary font-mono font-semibold">
                {profile.reference}
              </span>
              . Quote it to anyone sending wine to us.
            </>
          ) : undefined
        }
        className="mb-0"
      />

      {isLoading && <CellarState kind="loading" className="mt-6" />}

      {isError && <CellarState kind="error" className="mt-6" />}

      {/*
        Someone the cellar is shared with sees where wine goes and their own
        access, and nothing of the holder's identity or contact details to
        edit; the server refuses those changes to anyone but the holder.
      */}
      {!isLoading && !isError && isDelegate && (
        <div className="mt-6 flex flex-col gap-5">
          <section className="border-border-muted bg-surface-primary rounded-xl border px-4 py-4 shadow-sm">
            <Typography variant="bodySm" className="font-semibold">
              Delivery
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="block">
              {profile?.deliveryAddress ?? 'No delivery address saved yet.'}
              {profile?.deliveryInstructions
                ? ` · ${profile.deliveryInstructions}`
                : ''}
            </Typography>
          </section>
          <CellarAccessPanel />
          <CellarInstallCard placement="details" />
          <CellarPasskeyCard placement="details" />
        </div>
      )}

      {!isLoading && !isError && !isDelegate && (
        <div className="mt-6 flex flex-col gap-5">
          <section className="border-border-muted bg-surface-primary rounded-xl border px-4 py-4 shadow-sm">
            <Typography variant="bodySm" className="font-semibold">
              Delivery
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="mb-3 block">
              Your main address is used unless you choose another when you
              request a delivery.
            </Typography>

            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  Main delivery address
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

            <DeliveryAddressBook
              onMainChanged={(main) => {
                /*
                  The form above shows the main address. Moved straight to the
                  new one, without touching anything else the member may be
                  part-way through typing.
                */
                setForm((current) => ({
                  ...current,
                  deliveryAddress: main.address,
                  deliveryInstructions: main.instructions ?? '',
                }));
                void refetch();
              }}
            />
          </section>

          <section className="border-border-muted bg-surface-primary rounded-xl border px-4 py-4 shadow-sm">
            <Typography variant="bodySm" className="font-semibold">
              Identification
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="mb-3 block">
              The licensed partner delivering on the mainland has to establish
              who is receiving the wine. Held once, used for every delivery.
            </Typography>

            {expiryWarning && (
              <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
                <Typography variant="bodyXs" className="text-amber-800 dark:text-amber-300">
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
                <Input
                  type="date"
                  value={form.eidExpiry}
                  onChange={(event) => update('eidExpiry', event.target.value)}
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
                          existing ? 'text-emerald-600' : 'text-text-muted'
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
                      {existing && confirmRemove === document.type && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-text-muted text-xs">Remove?</span>
                          <button
                            type="button"
                            onClick={() =>
                              remove({ documentType: document.type })
                            }
                            className="h-9 rounded-lg px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(null)}
                            className="text-text-muted hover:text-text-primary h-9 rounded-lg px-2.5 text-xs font-semibold"
                          >
                            No
                          </button>
                        </span>
                      )}
                      {existing && confirmRemove !== document.type && (
                        <>
                          <a
                            href={`/api/cellar/identity?type=${document.type}`}
                            target="_blank"
                            rel="noreferrer"
                                            className="text-text-primary inline-flex h-9 items-center px-1 text-xs font-semibold underline underline-offset-2"
                          >
                            View
                          </a>
                          <button
                            type="button"
                            aria-label={`Remove ${document.label}`}
                            className="text-text-muted hover:text-text-primary hover:bg-fill-muted inline-flex size-9 items-center justify-center rounded-lg transition-colors"
                            onClick={() => setConfirmRemove(document.type)}
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button
              size="lg"
              className="justify-center border-transparent bg-text-primary text-surface-primary hover:bg-text-primary/90 active:bg-text-primary"
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

          <CellarAccessPanel />
          {/* Signing in on a phone: home screen and Face ID live here for good */}
          <CellarInstallCard placement="details" />
          <CellarPasskeyCard placement="details" />
        </div>
      )}
    </div>
  );
};

export default CellarProfilePage;
