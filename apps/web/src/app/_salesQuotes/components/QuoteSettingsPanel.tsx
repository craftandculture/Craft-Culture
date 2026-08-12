'use client';

import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';

import type { QuoteFormState } from '../types';

export interface QuoteSettingsPanelProps {
  form: QuoteFormState;
  onChange: (patch: Partial<QuoteFormState>) => void;
}

interface FieldProps {
  label: string;
  hint?: string;
}

const Field = ({
  label,
  hint,
  children,
}: React.PropsWithChildren<FieldProps>) => (
  <label className="block space-y-1">
    <Typography variant="bodyXs" colorRole="muted" asChild>
      <span>{label}</span>
    </Typography>
    {children}
    {hint ? (
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <span className="text-xs opacity-70">{hint}</span>
      </Typography>
    ) : null}
  </label>
);

const Toggle = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className="flex items-start gap-2">
    <Checkbox
      className="mt-0.5"
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
    />
    <span>
      <Typography variant="bodyXs" asChild>
        <span className="block">{label}</span>
      </Typography>
      {hint ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <span className="block opacity-70">{hint}</span>
        </Typography>
      ) : null}
    </span>
  </label>
);

/**
 * Header fields and template options for a quote.
 *
 * The options map one-to-one onto the standard template's own toggles, so what
 * is set here is exactly what the client sees. Defaults match how the recent
 * hand-built quotes were configured: priced per bottle, offered quantities, and
 * stock-location chips on.
 */
const QuoteSettingsPanel = ({ form, onChange }: QuoteSettingsPanelProps) => (
  <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Client" hint="Shown as “Prepared for …”">
        <Input
          value={form.client}
          onChange={(event) => onChange({ client: event.target.value })}
        />
      </Field>

      <Field label="Company">
        <Input
          value={form.clientCompany}
          onChange={(event) => onChange({ clientCompany: event.target.value })}
        />
      </Field>

      <Field label="Contact name">
        <Input
          value={form.contactName}
          onChange={(event) => onChange({ contactName: event.target.value })}
        />
      </Field>

      <Field label="Contact email">
        <Input
          type="email"
          value={form.contactEmail}
          onChange={(event) => onChange({ contactEmail: event.target.value })}
        />
      </Field>

      <Field label="Quote ref" hint="e.g. TBS-1108">
        <Input
          value={form.quoteRef}
          onChange={(event) => onChange({ quoteRef: event.target.value })}
        />
      </Field>

      <Field label="URL slug" hint={`Public link: /q/${form.slug || '…'}`}>
        <Input
          value={form.slug}
          onChange={(event) =>
            onChange({
              slug: event.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, '-')
                .replace(/-+/g, '-'),
            })
          }
        />
      </Field>

      <Field label="Valid until">
        <Input
          type="date"
          value={form.validUntil}
          onChange={(event) => onChange({ validUntil: event.target.value })}
        />
      </Field>

      <Field label="Promo until" hint="Defaults to the validity date">
        <Input
          type="date"
          value={form.promoUntil}
          onChange={(event) => onChange({ promoUntil: event.target.value })}
        />
      </Field>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Eyebrow" hint="Small label above the heading">
        <Input
          value={form.eyebrow}
          onChange={(event) => onChange({ eyebrow: event.target.value })}
        />
      </Field>

      <Field label="Heading">
        <Input
          value={form.h1}
          onChange={(event) => onChange({ h1: event.target.value })}
        />
      </Field>
    </div>

    <Field label="Subtitle" hint="Also used in the link preview">
      <Input
        value={form.subtitle}
        onChange={(event) => onChange({ subtitle: event.target.value })}
      />
    </Field>

    <div className="space-y-3 rounded-lg border border-border-muted p-3">
      <Typography variant="bodyXs" asChild>
        <p className="font-semibold uppercase tracking-wide">
          Template options
        </p>
      </Typography>

      <div className="grid gap-3 md:grid-cols-2">
        <Toggle
          label="Price and order per bottle"
          hint="Off = sold by the case"
          checked={form.orderUnit === 'bottle'}
          onChange={(value) =>
            onChange({ orderUnit: value ? 'bottle' : 'case' })
          }
        />
        <Toggle
          label="Hide pack configs and case prices"
          hint="Leave off so the client can see what a case contains"
          checked={form.bottlesOnly}
          onChange={(value) => onChange({ bottlesOnly: value })}
        />
        <Toggle
          label="Show offered quantities"
          hint="Reads “6 of 12 bottles” where more stock sits behind the line"
          checked={form.offered}
          onChange={(value) => onChange({ offered: value })}
        />
        <Toggle
          label="Show stock-location chips"
          hint="Marks each line as warehouse-held or inbound"
          checked={form.stockStatus}
          onChange={(value) => onChange({ stockStatus: value })}
        />
      </div>

      {form.stockStatus ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Held chip">
            <Input
              value={form.whLabel}
              onChange={(event) => onChange({ whLabel: event.target.value })}
            />
          </Field>
          <Field label="Inbound chip">
            <Input
              value={form.ibLabel}
              onChange={(event) => onChange({ ibLabel: event.target.value })}
            />
          </Field>
          <Field label="Private-client chip">
            <Input
              value={form.pcLabel}
              onChange={(event) => onChange({ pcLabel: event.target.value })}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Price basis" hint="Appears in the header and footer">
        <Input
          value={form.priceBasis}
          onChange={(event) => onChange({ priceBasis: event.target.value })}
        />
      </Field>
    </div>
  </div>
);

export default QuoteSettingsPanel;
