'use client';

import { useEffect, useState } from 'react';

import Input from '@/app/_ui/components/Input/Input';
import Label from '@/app/_ui/components/Label/Label';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';

import {
  type CalculationVariables,
  defaultCalculationVariables,
} from '../schemas/calculationVariablesSchema';

interface VariablesPanelProps {
  variables: CalculationVariables | null;
  onChange: (variables: CalculationVariables) => void;
  isUpdating?: boolean;
}

/**
 * Configuration panel for pricing calculation variables
 *
 * Includes currency rates, margin settings, freight costs, and D2C parameters
 */
const VariablesPanel = ({ variables, onChange, isUpdating }: VariablesPanelProps) => {
  const [localVariables, setLocalVariables] = useState<CalculationVariables>(
    variables ?? defaultCalculationVariables,
  );

  // Sync with external changes
  useEffect(() => {
    if (variables) {
      setLocalVariables(variables);
    }
  }, [variables]);

  const handleChange = <K extends keyof CalculationVariables>(
    field: K,
    value: CalculationVariables[K],
  ) => {
    const updated = { ...localVariables, [field]: value };
    setLocalVariables(updated);
  };

  const handleBlur = () => {
    onChange(localVariables);
  };

  const handleSelectChange = <K extends keyof CalculationVariables>(
    field: K,
    value: CalculationVariables[K],
  ) => {
    const updated = { ...localVariables, [field]: value };
    setLocalVariables(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Currency & Exchange Rates */}
      <div>
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          Currency & Exchange Rates
        </Typography>
        <div className="space-y-3">
          <div>
            <Label htmlFor="inputCurrency" className="text-xs">
              Input Currency
            </Label>
            <Select
              value={localVariables.inputCurrency}
              onValueChange={(v) =>
                handleSelectChange('inputCurrency', v as CalculationVariables['inputCurrency'])
              }
              disabled={isUpdating}
            >
              <SelectTrigger id="inputCurrency" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="gbpToUsdRate" className="text-xs">
                GBP → USD
              </Label>
              <Input
                id="gbpToUsdRate"
                type="number"
                step="0.01"
                value={localVariables.gbpToUsdRate}
                onChange={(e) => handleChange('gbpToUsdRate', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="eurToUsdRate" className="text-xs">
                EUR → USD
              </Label>
              <Input
                id="eurToUsdRate"
                type="number"
                step="0.01"
                value={localVariables.eurToUsdRate}
                onChange={(e) => handleChange('eurToUsdRate', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="usdToAedRate" className="text-xs">
              USD → AED
            </Label>
            <Input
              id="usdToAedRate"
              type="number"
              step="0.01"
              value={localVariables.usdToAedRate}
              onChange={(e) => handleChange('usdToAedRate', parseFloat(e.target.value) || 0)}
              onBlur={handleBlur}
              disabled={isUpdating}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Margin Settings */}
      <div>
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          C&C Margin (Before Freight)
        </Typography>
        <div className="space-y-3">
          <div>
            <Label htmlFor="marginType" className="text-xs">
              Margin Type
            </Label>
            <Select
              value={localVariables.marginType}
              onValueChange={(v) =>
                handleSelectChange('marginType', v as CalculationVariables['marginType'])
              }
              disabled={isUpdating}
            >
              <SelectTrigger id="marginType" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="absolute">Absolute ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {localVariables.marginType === 'percentage' ? (
            <div>
              <Label htmlFor="marginPercent" className="text-xs">
                Margin % (price &divide; {(1 - localVariables.marginPercent / 100).toFixed(2)})
              </Label>
              <Input
                id="marginPercent"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={localVariables.marginPercent}
                onChange={(e) => handleChange('marginPercent', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="marginAbsolute" className="text-xs">
                Margin ($ per case)
              </Label>
              <Input
                id="marginAbsolute"
                type="number"
                step="100"
                min="0"
                value={localVariables.marginAbsolute}
                onChange={(e) => handleChange('marginAbsolute', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          )}
        </div>
      </div>

      {/* Freight Settings */}
      <div>
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          Freight
        </Typography>
        <div className="space-y-3">
          <div>
            <Label htmlFor="shippingMethod" className="text-xs">
              Shipping Method
            </Label>
            <Select
              value={localVariables.shippingMethod}
              onValueChange={(v) =>
                handleSelectChange('shippingMethod', v as CalculationVariables['shippingMethod'])
              }
              disabled={isUpdating}
            >
              <SelectTrigger id="shippingMethod" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="air">Air</SelectItem>
                <SelectItem value="sea">Sea</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="airFreightPerCase" className="text-xs">
                Air ($/case)
              </Label>
              <Input
                id="airFreightPerCase"
                type="number"
                step="1"
                min="0"
                value={localVariables.airFreightPerCase}
                onChange={(e) => handleChange('airFreightPerCase', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="seaFreightPerCase" className="text-xs">
                Sea ($/case)
              </Label>
              <Input
                id="seaFreightPerCase"
                type="number"
                step="1"
                min="0"
                value={localVariables.seaFreightPerCase}
                onChange={(e) => handleChange('seaFreightPerCase', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          </div>
        </div>
      </div>

      {/* D2C Settings */}
      <div>
        <Typography variant="bodyXs" colorRole="muted" className="mb-2 uppercase tracking-wide">
          D2C Settings
        </Typography>
        <div className="space-y-3">
          <div>
            <Label htmlFor="salesAdvisorMarginPercent" className="text-xs">
              Sales Advisor Margin %
            </Label>
            <Input
              id="salesAdvisorMarginPercent"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={localVariables.salesAdvisorMarginPercent}
              onChange={(e) =>
                handleChange('salesAdvisorMarginPercent', parseFloat(e.target.value) || 0)
              }
              onBlur={handleBlur}
              disabled={isUpdating}
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="importDutyPercent" className="text-xs">
                Import Duty %
              </Label>
              <Input
                id="importDutyPercent"
                type="number"
                step="1"
                min="0"
                max="100"
                value={localVariables.importDutyPercent}
                onChange={(e) => handleChange('importDutyPercent', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="localCosts" className="text-xs">
                Local Costs ($)
              </Label>
              <Input
                id="localCosts"
                type="number"
                step="1"
                min="0"
                value={localVariables.localCosts}
                onChange={(e) => handleChange('localCosts', parseFloat(e.target.value) || 0)}
                onBlur={handleBlur}
                disabled={isUpdating}
                className="h-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="vatPercent" className="text-xs">
              VAT %
            </Label>
            <Input
              id="vatPercent"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={localVariables.vatPercent}
              onChange={(e) => handleChange('vatPercent', parseFloat(e.target.value) || 0)}
              onBlur={handleBlur}
              disabled={isUpdating}
              className="h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariablesPanel;
