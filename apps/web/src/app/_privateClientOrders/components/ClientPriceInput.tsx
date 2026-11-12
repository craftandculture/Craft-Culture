'use client';

import { useState } from 'react';

import Input from '@/app/_ui/components/Input/Input';
import USD_TO_AED from '@/lib/currency/usdToAed';
import { round2, supplierPriceForFinalPrice } from '@/lib/pricing/pricingEngine';
import type { PCOPricingVariables } from '@/lib/pricing/types';

export interface ClientPriceInputProps {
  /** The rates this order is priced at; without them the box is not shown */
  rates: PCOPricingVariables | null | undefined;
  /** Receives the supplier price, in USD per unit, that gives the typed client price */
  onPrice: (pricePerUnitUsd: number) => void;
}

/**
 * "Client pays" box under a PCO line's price
 *
 * Staff type the client's agreed price, in AED incl. VAT per unit, and the
 * line's starting price is worked back from it at this order's rates.
 */
const ClientPriceInput = ({ rates, onPrice }: ClientPriceInputProps) => {
  const [aed, setAed] = useState('');

  if (!rates) return null;

  return (
    <Input
      type="number"
      min={0}
      step={0.01}
      placeholder="Client pays AED"
      aria-label="Client pays, AED incl. VAT per unit"
      title="Client pays, AED incl. VAT per unit. The price is worked back from it at this order's rates."
      value={aed}
      onChange={(e) => {
        setAed(e.target.value);
        const value = parseFloat(e.target.value);
        if (Number.isFinite(value) && value > 0) {
          onPrice(round2(supplierPriceForFinalPrice(value / USD_TO_AED, rates)));
        }
      }}
      className="mt-1 h-7 w-24 text-right text-xs"
    />
  );
};

export default ClientPriceInput;
