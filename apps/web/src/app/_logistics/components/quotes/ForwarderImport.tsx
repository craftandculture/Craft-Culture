'use client';

import { IconFileSpreadsheet } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import useTRPC from '@/lib/trpc/browser';

import parseForwarderSheet from '../../utils/parseForwarderSheet';
import type { ForwarderSheetRow } from '../../utils/parseForwarderSheet';
import { primaryButton, secondaryButton } from '../exports/exportUi';

export interface ForwarderImportProps {
  onDone: () => void;
}

/**
 * Bring in the forwarder list once, from a spreadsheet or pasted rows
 *
 * Needs a column for the company and one for email; contact name, phone,
 * role, modes, countries and notes are read when present. Shows what was
 * understood before anything is saved.
 */
const ForwarderImport = ({ onDone }: ForwarderImportProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ForwarderSheetRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');

  const take = (grid: unknown[][]) => {
    const { rows: found, header } = parseForwarderSheet(grid);
    setProblem(
      !header
        ? 'No header row found. The first row needs a "Forwarder" or "Company" column, and an "Email" column.'
        : found.length === 0
          ? 'A header was found, but no rows with a company and an email under it.'
          : null,
    );
    setRows(found.length ? found : null);
  };

  const readFile = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
    if (!sheet) return setProblem('The file has no sheets.');
    take(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }));
  };

  const importRows = useMutation({
    ...api.logistics.admin.forwarders.import.mutationOptions(),
    onSuccess: (r) => {
      toast.success(`${r.added} forwarder${r.added === 1 ? '' : 's'} added, ${r.updated} updated`);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'forwarders']] });
      onDone();
    },
    onError: (error) => toast.error(error.message || 'The list was not imported'),
  });

  const companies = rows ? new Set(rows.map((r) => r.name.toLowerCase())).size : 0;

  return (
    <div className="space-y-3">
      {!rows && (
        <>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-muted p-6 text-center hover:border-text-primary">
            <IconFileSpreadsheet size={22} className="mb-2 text-text-muted" />
            <span className="text-sm text-text-primary">Choose the forwarder list (Excel or CSV)</span>
            <span className="mt-1 text-xs text-text-muted">
              Columns: Forwarder, Email, and if you have them Contact, Phone, Role, Modes, Countries, Notes
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={4}
            placeholder="Or paste the rows from Excel here, header row included"
            className="w-full rounded-lg border border-border-muted bg-surface-primary p-3 text-sm text-text-primary focus:border-text-primary focus:outline-none"
          />
          <button
            type="button"
            className={secondaryButton}
            disabled={pasted.trim().length < 10}
            onClick={() => take(pasted.split('\n').map((line) => line.split(line.includes('\t') ? '\t' : ',')))}
          >
            Read the pasted rows
          </button>
        </>
      )}

      {problem && <p className="text-sm text-red-600">{problem}</p>}

      {rows && (
        <>
          <p className="text-sm text-text-primary">
            {companies} forwarder{companies === 1 ? '' : 's'}, {rows.filter((r) => r.email).length} email
            {rows.filter((r) => r.email).length === 1 ? '' : 's'}. Forwarders already on the list keep what they have and
            gain anything new.
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-border-muted">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-muted text-left text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-3 py-2 font-medium">Forwarder</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Covers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-text-primary">{r.name}</td>
                    <td className="px-3 py-1.5 text-text-muted">{[r.contactName, r.role].filter(Boolean).join(', ')}</td>
                    <td className={`px-3 py-1.5 ${r.email ? 'text-text-primary' : 'text-amber-600'}`}>
                      {r.email ?? 'no email'}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted">
                      {[...r.modes.map((m) => m.replace('_', ' ')), ...r.originCountries].join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={importRows.isPending}
              onClick={() => importRows.mutate({ rows })}
            >
              Import {companies} forwarder{companies === 1 ? '' : 's'}
            </button>
            <button type="button" className={secondaryButton} onClick={() => setRows(null)}>
              Start again
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ForwarderImport;
