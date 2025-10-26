import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

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

describe('B2BCalculator', () => {
  describe('rendering', () => {
    it('should render collapsed accordion by default', () => {
      render(<B2BCalculator inBondPriceUsd={5000} />);

      expect(
        screen.getByRole('button', { name: /b2b pricing calculator/i }),
      ).toBeInTheDocument();

      // Content should not be visible initially
      expect(screen.queryByText('Baseline price')).not.toBeInTheDocument();
    });

    it('should expand accordion when clicked', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      const button = screen.getByRole('button', { name: /b2b pricing calculator/i });
      await user.click(button);

      // Content should now be visible
      expect(screen.getByText('Baseline price')).toBeInTheDocument();
      expect(screen.getByText('Cost inputs')).toBeInTheDocument();
    });

    it('should collapse accordion when clicked again', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      const button = screen.getByRole('button', { name: /b2b pricing calculator/i });

      // Expand
      await user.click(button);
      expect(screen.getByText('Baseline price')).toBeInTheDocument();

      // Collapse
      await user.click(button);
      expect(screen.queryByText('Baseline price')).not.toBeInTheDocument();
    });
  });

  describe('baseline price display', () => {
    it('should display in bond price in USD by default', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // formatPrice rounds to whole numbers
      expect(screen.getByText('US$5,000')).toBeInTheDocument();
    });

    it('should display in bond price label', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      expect(screen.getByText('In bond UAE price')).toBeInTheDocument();
    });
  });

  describe('calculator inputs', () => {
    it('should render all input fields with default values', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // Check for input labels
      expect(screen.getByText('Transfer cost')).toBeInTheDocument();
      expect(screen.getByText('Import tax')).toBeInTheDocument();
      expect(screen.getByText('Distributor margin')).toBeInTheDocument();

      // Check default values (inputs should have these values)
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(200); // Transfer cost
      expect(inputs[1]).toHaveValue(20); // Import tax
      expect(inputs[2]).toHaveValue(15); // Distributor margin
    });

    it('should update calculations when transfer cost changes', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      const transferInput = screen.getAllByRole('spinbutton')[0];

      // Change transfer cost from 200 to 300
      await user.clear(transferInput);
      await user.type(transferInput, '300');

      // Customer price should update (+$100)
      // Original: 5000 + 1000 + 750 + 200 = 6950
      // New: 5000 + 1000 + 750 + 300 = 7050
      expect(screen.getByText('US$7,050')).toBeInTheDocument();
    });

    it('should update calculations when import tax changes', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      const importTaxInput = screen.getAllByRole('spinbutton')[1];

      // Change import tax from 20% to 25%
      await user.clear(importTaxInput);
      await user.type(importTaxInput, '25');

      // Customer price should update
      // 5000 + 1250 (25%) + 750 + 200 = 7200
      expect(screen.getByText('US$7,200')).toBeInTheDocument();
    });

    it('should update calculations when distributor margin changes', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      const marginInput = screen.getAllByRole('spinbutton')[2];

      // Change margin from 15% to 20%
      await user.clear(marginInput);
      await user.type(marginInput, '20');

      // Customer price should update
      // 5000 + 1000 + 1000 (20%) + 200 = 7200
      expect(screen.getByText('US$7,200')).toBeInTheDocument();
    });
  });

  describe('margin toggle functionality', () => {
    it('should toggle between percentage and fixed margin modes', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

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

      // Customer price: 5000 + 1000 + 15 (fixed) + 200 = 6215
      expect(screen.getByText('US$6,215')).toBeInTheDocument();
    });

    it('should calculate correctly with fixed margin value', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // Toggle to fixed mode
      const toggleSwitch = screen.getByRole('switch', {
        name: /toggle between percentage and fixed margin/i,
      });
      await user.click(toggleSwitch);

      // Change fixed margin to $1000
      const marginInput = screen.getAllByRole('spinbutton')[2];
      await user.clear(marginInput);
      await user.type(marginInput, '1000');

      // Customer price: 5000 + 1000 + 1000 + 200 = 7200
      expect(screen.getByText('US$7,200')).toBeInTheDocument();
    });
  });

  describe('currency toggle', () => {
    it('should toggle between USD and AED display', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // Initially USD
      expect(screen.getByText('US$5,000')).toBeInTheDocument();

      // Find currency toggle switch
      const currencyToggle = screen.getByRole('switch', {
        name: /toggle currency display/i,
      });

      // Toggle to AED
      await user.click(currencyToggle);

      // Should now show AED (5000 * 3.67 = 18350)
      expect(screen.getByText('18,350')).toBeInTheDocument();
    });

    it('should convert all prices when currency is toggled', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // Toggle to AED
      const currencyToggle = screen.getByRole('switch', {
        name: /toggle currency display/i,
      });
      await user.click(currencyToggle);

      // All breakdown values should be in AED
      // In bond: 5000 * 3.67 = 18350
      // Import tax: 1000 * 3.67 = 3670
      // Margin: 750 * 3.67 = 2752.5 ≈ 2753
      // Transfer: 200 * 3.67 = 734
      // Total: 6950 * 3.67 = 25506.5 ≈ 25,507
      expect(screen.getByText('18,350')).toBeInTheDocument(); // In bond
      expect(screen.getByText('25,507')).toBeInTheDocument(); // Total
    });
  });

  describe('reset functionality', () => {
    it('should reset all values to defaults when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // Change all values
      const inputs = screen.getAllByRole('spinbutton');
      await user.clear(inputs[0]);
      await user.type(inputs[0], '300'); // Transfer cost
      await user.clear(inputs[1]);
      await user.type(inputs[1], '25'); // Import tax
      await user.clear(inputs[2]);
      await user.type(inputs[2], '20'); // Margin

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      await user.click(resetButton);

      // All values should be back to defaults
      expect(inputs[0]).toHaveValue(200);
      expect(inputs[1]).toHaveValue(20);
      expect(inputs[2]).toHaveValue(15);

      // Customer price should be default calculation
      expect(screen.getByText('US$6,950')).toBeInTheDocument();
    });
  });

  describe('export functionality', () => {
    it('should export to Excel when export button is clicked', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

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
      render(<B2BCalculator inBondPriceUsd={5000} />);

      const accordionButton = screen.getByRole('button', {
        name: /b2b pricing calculator/i,
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
      render(<B2BCalculator inBondPriceUsd={5000} />);

      const button = screen.getByRole('button', { name: /b2b pricing calculator/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByText('Baseline price')).toBeInTheDocument();
    });

    it('should have aria labels for switches', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={5000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

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
      render(<B2BCalculator inBondPriceUsd={0} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // Only transfer cost should contribute
      expect(screen.getByText('US$200')).toBeInTheDocument();
    });

    it('should handle very large in bond price', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={1000000} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // 1000000 + 200000 + 150000 + 200 = 1350200
      expect(screen.getByText('US$1,350,200')).toBeInTheDocument();
    });

    it('should handle decimal in bond price', async () => {
      const user = userEvent.setup();
      render(<B2BCalculator inBondPriceUsd={1234.56} />);

      await user.click(screen.getByRole('button', { name: /b2b pricing calculator/i }));

      // Should display and calculate correctly (values are rounded in display)
      expect(screen.getByText('US$1,235')).toBeInTheDocument();
    });
  });
});
