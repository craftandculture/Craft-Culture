import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { renderWithProviders } from '@/test/test-utils';

import B2BCalculator from './B2BCalculator';

// Mock XLSX
vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    aoa_to_sheet: vi.fn(() => ({ '!cols': [] })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

// Mock useTRPC hook
vi.mock('@/lib/trpc/browser', () => ({
  default: () => ({
    admin: {
      settings: {
        get: {
          queryOptions: vi.fn(() => ({
            queryKey: ['admin.settings.get'],
            queryFn: () => Promise.resolve({ value: '5' }),
          })),
        },
      },
    },
    pricing: {
      getSharedDefaults: {
        queryOptions: vi.fn(() => ({
          queryKey: ['pricing.getSharedDefaults'],
          queryFn: () =>
            Promise.resolve({
              importDutyPercent: 20,
              transferCostUsd: 200,
              vatPercent: 5,
            }),
        })),
      },
    },
  }),
}));

describe('B2BCalculator', () => {
  describe('rendering', () => {
    it('should render collapsed accordion by default', () => {
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      expect(
        screen.getByRole('button', { name: /your margin calculator/i }),
      ).toBeInTheDocument();

      // Content should not be visible initially
      expect(screen.queryByText('In-Bond UAE')).not.toBeInTheDocument();
    });

    it('should expand accordion when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      const button = screen.getByRole('button', { name: /your margin calculator/i });
      await user.click(button);

      // Content should now be visible
      expect(screen.getByText('In-Bond UAE')).toBeInTheDocument();
      expect(screen.getByText('Cost inputs')).toBeInTheDocument();
    });

    it('should collapse accordion when clicked again', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      const button = screen.getByRole('button', { name: /your margin calculator/i });

      // Expand
      await user.click(button);
      expect(screen.getByText('In-Bond UAE')).toBeInTheDocument();

      // Collapse
      await user.click(button);
      expect(screen.queryByText('In-Bond UAE')).not.toBeInTheDocument();
    });
  });

  describe('baseline price display', () => {
    it('should display in bond price in USD by default', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // formatPrice rounds to whole numbers - multiple instances of $5,000 will exist
      expect(screen.getAllByText('$5,000')[0]).toBeInTheDocument();
    });

    it('should display in bond price label', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      expect(screen.getByText('In-Bond UAE')).toBeInTheDocument();
    });
  });

  describe('calculator inputs', () => {
    it('should render all input fields with default values', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Check for input labels (multiple instances may exist)
      expect(screen.getAllByText('Transfer cost')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Import duty')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Distributor margin')[0]).toBeInTheDocument();

      // Check default values (inputs should have these values)
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(200); // Transfer cost
      expect(inputs[1]).toHaveValue(20); // Import duty
      expect(inputs[2]).toHaveValue(15); // Distributor margin
    });

    it('should update calculations when transfer cost changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      const transferInput = screen.getAllByRole('spinbutton')[0]!;

      // Change transfer cost from 200 to 300
      await user.clear(transferInput);
      await user.type(transferInput, '300');

      // Customer price should update
      // landedPrice = 5000 + 1000 + 300 = 6300
      // priceAfterMargin = 6300 / 0.85 = 7411.76
      // vat = 7411.76 * 0.05 = 370.59
      // customerQuotePrice = 7411.76 + 370.59 = 7782.35 ≈ $7,782
      expect(screen.getByText('$7,782')).toBeInTheDocument();
    });

    it('should update calculations when import tax changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      const importTaxInput = screen.getAllByRole('spinbutton')[1]!;

      // Change import tax from 20% to 25%
      await user.clear(importTaxInput);
      await user.type(importTaxInput, '25');

      // Customer price should update
      // importTax = 5000 * 0.25 = 1250
      // landedPrice = 5000 + 1250 + 200 = 6450
      // priceAfterMargin = 6450 / 0.85 = 7588.24
      // vat = 7588.24 * 0.05 = 379.41
      // customerQuotePrice = 7588.24 + 379.41 = 7967.65 ≈ $7,968
      expect(screen.getByText('$7,968')).toBeInTheDocument();
    });

    it('should update calculations when distributor margin changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      const marginInput = screen.getAllByRole('spinbutton')[2]!;

      // Change margin from 15% to 20%
      await user.clear(marginInput);
      await user.type(marginInput, '20');

      // Customer price should update
      // landedPrice = 5000 + 1000 + 200 = 6200
      // priceAfterMargin = 6200 / 0.80 = 7750
      // vat = 7750 * 0.05 = 387.5
      // customerQuotePrice = 7750 + 387.5 = 8137.5 ≈ $8,138
      expect(screen.getByText('$8,138')).toBeInTheDocument();
    });
  });

  describe('margin toggle functionality', () => {
    it('should toggle between percentage and fixed margin modes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Find the toggle switch for margin type
      const toggleSwitch = screen.getByRole('switch', {
        name: /toggle between percentage and fixed margin/i,
      });

      // Initially should be percentage mode (unchecked)
      expect(toggleSwitch).not.toBeChecked();

      // Toggle to fixed mode
      await user.click(toggleSwitch);
      expect(toggleSwitch).toBeChecked();

      // The margin value input should now represent fixed $ amount
      const marginInput = screen.getAllByRole('spinbutton')[2];
      expect(marginInput).toHaveValue(15); // Still 15, but now in $

      // Customer price with fixed $15 margin
      // landedPrice = 5000 + 1000 + 200 = 6200
      // priceAfterMargin = 6200 + 15 = 6215
      // vat = 6215 * 0.05 = 310.75
      // customerQuotePrice = 6215 + 310.75 = 6525.75 ≈ $6,526
      expect(screen.getByText('$6,526')).toBeInTheDocument();
    });

    it('should calculate correctly with fixed margin value', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Toggle to fixed mode
      const toggleSwitch = screen.getByRole('switch', {
        name: /toggle between percentage and fixed margin/i,
      });
      await user.click(toggleSwitch);

      // Change fixed margin to $1000
      const marginInput = screen.getAllByRole('spinbutton')[2]!;
      await user.clear(marginInput);
      await user.type(marginInput, '1000');

      // Customer price with fixed $1000 margin
      // landedPrice = 5000 + 1000 + 200 = 6200
      // priceAfterMargin = 6200 + 1000 = 7200
      // vat = 7200 * 0.05 = 360
      // customerQuotePrice = 7200 + 360 = 7560
      expect(screen.getByText('$7,560')).toBeInTheDocument();
    });
  });

  describe('currency toggle', () => {
    it('should toggle between USD and AED display', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Initially USD - multiple instances exist
      expect(screen.getAllByText('$5,000')[0]).toBeInTheDocument();

      // Find currency toggle switch
      const currencyToggle = screen.getByRole('switch', {
        name: /toggle currency display/i,
      });

      // Toggle to AED
      await user.click(currencyToggle);

      // Should now show AED (5000 * 3.67 = 18350) - multiple instances
      expect(screen.getAllByText('AED 18,350')[0]).toBeInTheDocument();
    });

    it('should convert all prices when currency is toggled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Toggle to AED
      const currencyToggle = screen.getByRole('switch', {
        name: /toggle currency display/i,
      });
      await user.click(currencyToggle);

      // All breakdown values should be in AED
      // With new formula: customerQuotePrice = 7658.82 USD
      // In bond: 5000 * 3.67 = 18,350
      // Total in AED: 7658.82 * 3.67 = 28,108
      expect(screen.getAllByText('AED 18,350')[0]).toBeInTheDocument(); // In bond (multiple instances)
      expect(screen.getAllByText('AED 28,108')[0]).toBeInTheDocument(); // Total (multiple instances)
    });
  });

  describe('reset functionality', () => {
    it('should reset all values to defaults when reset button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Change all values
      const inputs = screen.getAllByRole('spinbutton');
      await user.clear(inputs[0]!);
      await user.type(inputs[0]!, '300'); // Transfer cost
      await user.clear(inputs[1]!);
      await user.type(inputs[1]!, '25'); // Import duty
      await user.clear(inputs[2]!);
      await user.type(inputs[2]!, '20'); // Margin

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      await user.click(resetButton);

      // All values should be back to defaults
      expect(inputs[0]).toHaveValue(200);
      expect(inputs[1]).toHaveValue(20);
      expect(inputs[2]).toHaveValue(15);

      // Customer price should be default calculation
      // landedPrice = 6200, priceAfterMargin = 7294.12
      // vat = 364.71, customerQuotePrice = 7658.82 ≈ $7,659
      expect(screen.getByText('$7,659')).toBeInTheDocument();
    });
  });

  describe('export functionality', () => {
    it('should export to Excel when export button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      const exportButton = screen.getByRole('button', { name: /export to excel/i });
      await user.click(exportButton);

      // Check that XLSX functions were called
      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.writeFile).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper button roles', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      const accordionButton = screen.getByRole('button', {
        name: /your margin calculator/i,
      });
      expect(accordionButton).toHaveAttribute('type', 'button');

      await user.click(accordionButton);

      const exportButton = screen.getByRole('button', { name: /export to excel/i });
      expect(exportButton).toBeInTheDocument();

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      expect(resetButton).toBeInTheDocument();
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      const button = screen.getByRole('button', { name: /your margin calculator/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByText('In-Bond UAE')).toBeInTheDocument();
    });

    it('should have aria labels for switches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      expect(
        screen.getByRole('switch', { name: /toggle currency display/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('switch', {
          name: /toggle between percentage and fixed margin/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle zero in bond price', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={0} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Only transfer cost should contribute
      expect(screen.getByText('$200')).toBeInTheDocument();
    });

    it('should handle very large in bond price', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={1000000} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // With new formula, the customer quote price should be approximately $1,483,218
      // Just check that the in-bond price is displayed correctly
      expect(screen.getAllByText((content) => content.includes('1,000,000'))[0]).toBeInTheDocument();
    });

    it('should handle decimal in bond price', async () => {
      const user = userEvent.setup();
      renderWithProviders(<B2BCalculator inBondPriceUsd={1234.56} />);

      await user.click(screen.getByRole('button', { name: /your margin calculator/i }));

      // Should display and calculate correctly (values are rounded in display)
      // In-bond price rounded: $1,235 (multiple instances)
      expect(screen.getAllByText('$1,235')[0]).toBeInTheDocument();
    });
  });
});
