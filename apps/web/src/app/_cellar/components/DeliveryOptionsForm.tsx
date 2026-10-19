'use client';

import { IconGift, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

import Input from '@/app/_ui/components/Input/Input';

import earliestDeliveryDate, {
  DELIVERY_LEAD_WORKING_DAYS,
} from '../utils/earliestDeliveryDate';

export interface SavedAddress {
  id: string | null;
  label: string;
  address: string;
  instructions: string | null;
  isDefault: boolean;
}

export interface DeliveryChoice {
  /** A saved address; null means the default one */
  addressId: string | null;
  /** Typing a new address rather than choosing a saved one */
  isNew: boolean;
  newLabel: string;
  newAddress: string;
  newInstructions: string;
  saveNew: boolean;
  /** YYYY-MM-DD, or empty for no preference */
  preferredDate: string;
  preferredWindow: 'morning' | 'afternoon' | 'any';
  isGift: boolean;
  recipientName: string;
  recipientPhone: string;
  giftMessage: string;
}

export const EMPTY_DELIVERY_CHOICE: DeliveryChoice = {
  addressId: null,
  isNew: false,
  newLabel: '',
  newAddress: '',
  newInstructions: '',
  saveNew: true,
  preferredDate: '',
  preferredWindow: 'any',
  isGift: false,
  recipientName: '',
  recipientPhone: '',
  giftMessage: '',
};

export interface DeliveryOptionsFormProps {
  addresses: SavedAddress[];
  value: DeliveryChoice;
  onChange: (value: DeliveryChoice) => void;
}

/**
 * Gift deliveries, switched off for launch (Kevin, 19 October 2026): a
 * recipient, their mobile and a message made the first delivery request harder
 * than it needs to be. The fields stay in the request so turning this back on
 * is this one line.
 */
const GIFTS_ENABLED = false;

const LABEL =
  'text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider';

const WINDOWS = [
  { id: 'any', label: 'Any time' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
] as const;

/**
 * Where a delivery goes, when the member would like it, and whether it is a
 * gift
 *
 * Controlled: the cellar page owns the choice and sends it with the request.
 * Saved addresses are chosen, not retyped — four spellings of one villa leave
 * the team unable to tell which is current.
 *
 * The preferred day is a wish and the copy says so. The day is confirmed once
 * the delivery is arranged.
 */
const DeliveryOptionsForm = ({
  addresses,
  value,
  onChange,
}: DeliveryOptionsFormProps) => {
  const set = (patch: Partial<DeliveryChoice>) =>
    onChange({ ...value, ...patch });

  const fallbackAddress =
    addresses.find((address) => address.isDefault) ?? addresses[0];
  const selectedId = value.isNew
    ? 'new'
    : (value.addressId ?? fallbackAddress?.id ?? 'default');
  /* With nothing saved there is nothing to choose, so the form opens on a new address */
  const isTyping = value.isNew || addresses.length === 0;
  const earliest = earliestDeliveryDate();
  const earliestLabel = new Date(`${earliest}T12:00:00`).toLocaleDateString(
    'en-GB',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    },
  );
  const [isChoosingDay, setIsChoosingDay] = useState(
    Boolean(value.preferredDate),
  );

  return (
    <div className="space-y-4">
      {/*
        Asked first, because it changes the question that follows: "your
        address" becomes "their address".
      */}
      {GIFTS_ENABLED && (
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={value.isGift}
            onChange={(event) => set({ isGift: event.target.checked })}
          />
          <span>
            <span className="text-text-primary flex items-center gap-1.5 text-sm font-semibold">
              <IconGift
                size={15}
                className="text-emerald-700 dark:text-emerald-400"
              />
              Send this as a gift
            </span>
            <span className="text-text-muted block text-xs">
              Delivered to someone else, with a message from you if you wish.
            </span>
          </span>
        </label>
      )}

      {GIFTS_ENABLED && value.isGift && (
        <div className="grid gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 sm:grid-cols-2 dark:border-emerald-900/50 dark:bg-emerald-500/5">
          <label className="block">
            <span className={LABEL}>Their name</span>
            <Input
              value={value.recipientName}
              onChange={(event) => set({ recipientName: event.target.value })}
              placeholder="Full name"
            />
          </label>
          <label className="block">
            <span className={LABEL}>Their mobile</span>
            <Input
              value={value.recipientPhone}
              onChange={(event) => set({ recipientPhone: event.target.value })}
              placeholder="+971"
              inputMode="tel"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Gift message (optional)</span>
            <Input
              value={value.giftMessage}
              onChange={(event) => set({ giftMessage: event.target.value })}
              placeholder="A note to go with the wine"
              maxLength={300}
            />
          </label>
          {/*
            The law, said as a courtesy. The member needs to know before they
            surprise someone, not when the driver turns away.
          */}
          <p className="text-text-muted text-xs leading-5 sm:col-span-2">
            Whoever receives the wine must be 21 or over, and our driver may ask
            to see their Emirates ID or passport. We will call them to arrange a
            convenient time.
          </p>
        </div>
      )}

      <div>
        <span className={LABEL}>
          {value.isGift ? 'Their address' : 'Delivery address'}
        </span>
        {addresses.length > 0 && (
          <div className="grid gap-2">
            {addresses.map((address) => {
              const id = address.id ?? 'default';
              const isSelected = selectedId === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => set({ addressId: address.id, isNew: false })}
                  aria-pressed={isSelected}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 dark:border-emerald-500 dark:bg-emerald-500/10 dark:ring-emerald-500'
                      : 'border-border-muted hover:border-text-muted'
                  }`}
                >
                  <span className="text-text-primary flex items-center gap-1.5 text-sm font-semibold">
                    {address.label}
                    {address.isDefault && (
                      <span className="bg-fill-muted text-text-muted rounded-full px-1.5 py-px text-[10px] font-semibold">
                        Main
                      </span>
                    )}
                  </span>
                  <span className="text-text-muted mt-0.5 line-clamp-2 block text-xs">
                    {address.address}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => set({ isNew: true, addressId: null })}
              aria-pressed={value.isNew}
              className={`flex items-center gap-1.5 justify-self-start rounded-full px-1 py-1 text-xs font-semibold transition-colors ${
                value.isNew
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <IconPlus size={14} />
              Deliver to a new address
            </button>
          </div>
        )}

        {isTyping && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input
              value={value.newAddress}
              onChange={(event) => set({ newAddress: event.target.value })}
              placeholder="Villa or office, area, emirate"
              className="sm:col-span-2"
            />
            <Input
              value={value.newInstructions}
              onChange={(event) => set({ newInstructions: event.target.value })}
              placeholder="Access notes such as a gate code or who to ask for (optional)"
              className="sm:col-span-2"
            />
            <label className="text-text-muted flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={value.saveNew}
                onChange={(event) => set({ saveNew: event.target.checked })}
              />
              Save to my addresses as
            </label>
            {value.saveNew && (
              <Input
                value={value.newLabel}
                onChange={(event) => set({ newLabel: event.target.value })}
                placeholder={value.isGift ? 'e.g. Sara' : 'e.g. Office'}
                maxLength={60}
              />
            )}
          </div>
        )}
      </div>

      {/*
        "As soon as possible" is the default, and a day is something to opt
        into. A bare date field showed today's date in Safari, which looked
        chosen and was the one day that cannot be delivered.
      */}
      <div>
        <span className={LABEL}>When</span>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'soonest', label: 'Earliest available' },
            { id: 'day', label: 'Choose a day' },
          ].map((option) => {
            const isOn = option.id === 'day' ? isChoosingDay : !isChoosingDay;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isOn}
                onClick={() => {
                  setIsChoosingDay(option.id === 'day');
                  if (option.id === 'soonest') set({ preferredDate: '' });
                }}
                className={`h-9 rounded-full px-3 text-xs font-semibold transition-colors ${
                  isOn
                    ? 'bg-text-primary text-surface-primary'
                    : 'border-border-muted text-text-muted hover:text-text-primary border'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {isChoosingDay && (
          <Input
            type="date"
            min={earliest}
            value={value.preferredDate}
            onChange={(event) => set({ preferredDate: event.target.value })}
            className="mt-2 sm:max-w-xs"
            aria-label="Preferred day"
          />
        )}
        <p className="text-text-muted mt-2 text-xs leading-5">
          Wine is released from bond within {DELIVERY_LEAD_WORKING_DAYS} working
          days of your request; the earliest available date is {earliestLabel}.
          We will confirm the delivery date with you.
        </p>
        <span className={`${LABEL} mt-4`}>Time of day</span>
        <div className="flex flex-wrap gap-1.5">
          {WINDOWS.map((window) => (
            <button
              key={window.id}
              type="button"
              onClick={() => set({ preferredWindow: window.id })}
              aria-pressed={value.preferredWindow === window.id}
              className={`h-9 rounded-full px-3 text-xs font-semibold transition-colors ${
                value.preferredWindow === window.id
                  ? 'bg-text-primary text-surface-primary'
                  : 'border-border-muted text-text-muted hover:text-text-primary border'
              }`}
            >
              {window.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeliveryOptionsForm;
