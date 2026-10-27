'use client';

import { useEffect, useState } from 'react';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';

import UpdateCard from './UpdateCard';
import { UPDATE_TYPE_LABELS } from './UpdateTypeTag';
import memberLinks from '../constants/memberLinks';
import type { ProductUpdateAudience, ProductUpdateType } from '../types';
import lintMemberCopy from '../utils/lintMemberCopy';

export interface UpdateDraft {
  id?: string;
  type: ProductUpdateType;
  audiences: ProductUpdateAudience[];
  title: string;
  body: string;
  linkPath: string | null;
  sourceText?: string | null;
}

export interface UpdateEditDialogProps {
  /** The update being edited; null closes the dialog */
  draft: UpdateDraft | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: UpdateDraft) => void;
}

const AUDIENCES: { key: ProductUpdateAudience; label: string }[] = [
  { key: 'collector', label: 'Private Cellar' },
  { key: 'wine_partner', label: 'Trade partners' },
];

const fieldClass =
  'border-border-primary bg-background-primary text-text-primary w-full rounded-lg border px-3 py-2 text-sm';

/**
 * Edit an update's wording, with the member's view and the copy check live
 * beside it, and the changelog text it came from for reference
 */
const UpdateEditDialog = ({ draft, saving, onClose, onSave }: UpdateEditDialogProps) => {
  const [form, setForm] = useState<UpdateDraft | null>(draft);

  useEffect(() => setForm(draft), [draft]);

  if (!form) return null;

  const flags = lintMemberCopy(form);

  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit update' : 'New update'}</DialogTitle>
          <DialogDescription>Saving does not publish. Members only see it once it is published.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Type
                <select
                  className={fieldClass}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ProductUpdateType })}
                >
                  {(Object.keys(UPDATE_TYPE_LABELS) as ProductUpdateType[]).map((key) => (
                    <option key={key} value={key}>
                      {UPDATE_TYPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="flex flex-col gap-1 text-sm font-medium">
                For
                <div className="flex flex-wrap gap-4 font-normal">
                  {AUDIENCES.map((a) => (
                    <label key={a.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.audiences.includes(a.key)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            audiences: e.target.checked
                              ? [...form.audiences, a.key]
                              : form.audiences.filter((x) => x !== a.key),
                          })
                        }
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Title
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Text
                <textarea
                  className={`${fieldClass} min-h-24`}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Button to a screen
                <select
                  className={fieldClass}
                  value={form.linkPath ?? ''}
                  onChange={(e) => setForm({ ...form, linkPath: e.target.value || null })}
                >
                  <option value="">No button</option>
                  {memberLinks.collector.map((link) => (
                    <option key={link.path} value={link.path}>
                      {link.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <div>
                <p className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">As members see it</p>
                <UpdateCard type={form.type} title={form.title} body={form.body} linkPath={form.linkPath} preview />
              </div>
              {flags.length > 0 ? (
                <ul className="flex flex-col gap-1 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
                  {flags.map((flag) => (
                    <li key={flag}>⚠ {flag}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">Passes the member copy check</p>
              )}
              {form.sourceText && (
                <div className="bg-surface-muted rounded-lg px-3 py-2">
                  <p className="text-text-muted mb-1 text-xs font-semibold tracking-wider uppercase">From the release</p>
                  <p className="text-text-secondary font-mono text-xs leading-relaxed whitespace-pre-line">
                    {form.sourceText}
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="border-border-muted hover:bg-fill-muted rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !form.title.trim()}
            onClick={() => onSave(form)}
            className="bg-text-primary text-surface-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateEditDialog;
