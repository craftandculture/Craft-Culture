'use client';

import { IconTrash } from '@tabler/icons-react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';

import type { QuoteLineDraft } from '../types';

export interface QuoteLinesTableProps {
  lines: QuoteLineDraft[];
  onChange: (index: number, patch: Partial<QuoteLineDraft>) => void;
  onRemove: (index: number) => void;
}

/**
 * The selected lines, with everything that is per-line editable.
 *
 * Quantity is in bottles and left at 0 by default, which publishes the line as
 * an open offer showing full availability for the client to choose against.
 * Setting a quantity that is not a whole multiple of the pack will flag the
 * line as a Repack on the quote, which is surfaced here so it is a deliberate
 * choice rather than a surprise.
 */
const QuoteLinesTable = ({
  lines,
  onChange,
  onRemove,
}: QuoteLinesTableProps) => {
  if (!lines.length) {
    return (
      <div className="rounded-lg border border-dashed border-border-muted px-4 py-10 text-center">
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p>No lines yet — add references from the picker.</p>
        </Typography>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const repack = !!(line.qty && line.pack > 1 && line.qty % line.pack);

        return (
          <div
            key={`${line.lwin18}-${index}`}
            className="space-y-2 rounded-lg border border-border-muted p-3"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Typography variant="bodySm" asChild>
                  <p className="truncate">
                    {line.wine}{' '}
                    <span className="text-text-muted">{line.vintage}</span>
                  </p>
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <p>
                    {line.pack} ×{' '}
                    {line.size >= 100 ? `${line.size / 100}L` : `${line.size}cl`}{' '}
                    · {line.avail} btl available · $
                    {line.busd.toFixed(2)}/btl
                  </p>
                </Typography>
              </div>

              {repack ? <Badge colorRole="warning">Repack</Badge> : null}

              <Button
                size="sm"
                colorRole="danger"
                variant="ghost"
                onClick={() => onRemove(index)}
                aria-label="Remove line"
              >
                <IconTrash className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <label className="space-y-1">
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <span>Offer qty (btl)</span>
                </Typography>
                <Input
                  type="number"
                  min={0}
                  max={line.avail}
                  value={String(line.qty)}
                  onChange={(event) =>
                    onChange(index, {
                      qty: Math.max(
                        0,
                        Math.min(line.avail, Number(event.target.value) || 0),
                      ),
                    })
                  }
                />
              </label>

              <label className="space-y-1">
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <span>$ / bottle</span>
                </Typography>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(line.busd)}
                  onChange={(event) =>
                    onChange(index, {
                      busd: Math.max(0, Number(event.target.value) || 0),
                      // a manual price invalidates the catalogue's case price
                      cusd: undefined,
                      baed: undefined,
                      caed: undefined,
                    })
                  }
                />
              </label>

              <label className="space-y-1">
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <span>Section</span>
                </Typography>
                <Input
                  value={line.region}
                  onChange={(event) =>
                    onChange(index, { region: event.target.value })
                  }
                />
              </label>

              <label className="space-y-1">
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <span>Location chip</span>
                </Typography>
                <Input
                  placeholder="Default"
                  value={line.loc ?? ''}
                  onChange={(event) =>
                    onChange(index, { loc: event.target.value })
                  }
                />
              </label>
            </div>

            <label className="block space-y-1">
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <span>Note shown under the wine</span>
              </Typography>
              <Input
                placeholder="e.g. 15 cases (90 bottles) at $165 per bottle"
                value={line.note ?? ''}
                onChange={(event) =>
                  onChange(index, { note: event.target.value })
                }
              />
            </label>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={!!line.promo}
                  onCheckedChange={(checked) =>
                    onChange(index, { promo: checked === true })
                  }
                />
                <Typography variant="bodyXs" asChild>
                  <span>Discount promo</span>
                </Typography>
              </label>

              <label className="flex items-center gap-2">
                <Checkbox
                  checked={!!line.pc}
                  onCheckedChange={(checked) =>
                    onChange(index, { pc: checked === true })
                  }
                />
                <Typography variant="bodyXs" asChild>
                  <span>Private client</span>
                </Typography>
              </label>

              <label className="flex items-center gap-2">
                <Checkbox
                  checked={!!line.oos}
                  onCheckedChange={(checked) =>
                    onChange(index, { oos: checked === true })
                  }
                />
                <Typography variant="bodyXs" asChild>
                  <span>Show as sold out</span>
                </Typography>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QuoteLinesTable;
