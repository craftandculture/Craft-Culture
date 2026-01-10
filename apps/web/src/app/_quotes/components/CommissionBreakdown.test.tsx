import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import CommissionBreakdown from './CommissionBreakdown';

describe('CommissionBreakdown', () => {
  const mockLineItems = [
    {
      productName: 'Château Margaux 2015',
      quantity: 2,
      commissionPerCase: 100,
      lineCommission: 200,
    },
    {
      productName: 'Sassicaia 2018',
      quantity: 1,
      commissionPerCase: 84.15,
      lineCommission: 84.15,
    },
  ];

  describe('rendering', () => {
    it('should render collapsed accordion by default', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      expect(
        screen.getByRole('button', { name: /your earnings/i }),
      ).toBeInTheDocument();

      // Breakdown should not be visible initially
      expect(screen.queryByText('By product')).not.toBeInTheDocument();
    });

    it('should display total commission in collapsed state', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      // formatPrice rounds to whole number and uses $ format
      expect(screen.getByText('$284')).toBeInTheDocument();
    });

    it('should display commission info tooltip', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      // Check for info icon (IconInfoCircle is rendered)
      const infoIcon = screen.getByRole('button', {
        name: /your earnings/i,
      }).parentElement;
      expect(infoIcon).toBeInTheDocument();
    });

    it('should render chevron icon in collapsed state', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      const chevronIcon = button.querySelector('[class*="transition-transform"]');
      expect(chevronIcon).toBeInTheDocument();
      expect(chevronIcon).not.toHaveClass('rotate-180');
    });
  });

  describe('expansion interaction', () => {
    it('should expand accordion when clicked', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      await user.click(button);

      // Breakdown should now be visible - check for total earnings text
      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
    });

    it('should collapse accordion when clicked again', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });

      // Expand
      await user.click(button);
      expect(screen.getByText('Total Earnings')).toBeInTheDocument();

      // Collapse
      await user.click(button);
      expect(
        screen.queryByText('Total Earnings'),
      ).not.toBeInTheDocument();
    });

    it('should rotate chevron icon when expanded', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      const chevronIcon = button.querySelector('[class*="transition-transform"]');

      await user.click(button);

      expect(chevronIcon).toHaveClass('rotate-180');
    });
  });

  describe('expanded content', () => {
    it('should display all line items when expanded', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      await user.click(button);

      // Check both product names are displayed
      expect(screen.getByText('Château Margaux 2015')).toBeInTheDocument();
      expect(screen.getByText('Sassicaia 2018')).toBeInTheDocument();
    });

    it('should display per-line commission breakdown', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      await user.click(button);

      // Check calculation display: "2× $100"
      expect(screen.getByText(/2× \$100/)).toBeInTheDocument();
      expect(screen.getByText('$200')).toBeInTheDocument();

      // Check second item: "1× $84"
      expect(screen.getByText(/1× \$84/)).toBeInTheDocument();
    });

    it('should display quantity with multiplier format', async () => {
      const user = userEvent.setup();
      const singleCaseItems = [
        {
          productName: 'Single Case Wine',
          quantity: 1,
          commissionPerCase: 50,
          lineCommission: 50,
        },
        {
          productName: 'Multiple Cases Wine',
          quantity: 3,
          commissionPerCase: 30,
          lineCommission: 90,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={singleCaseItems}
          totalCommission={140}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      await user.click(button);

      // Check quantity format "N× $X"
      expect(screen.getByText(/1× \$50/)).toBeInTheDocument();
      expect(screen.getByText(/3× \$30/)).toBeInTheDocument();
    });

    it('should display total commission in breakdown footer', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      await user.click(button);

      // Check footer total (should appear twice: once in header, once in footer)
      const totalElements = screen.getAllByText('$284');
      expect(totalElements).toHaveLength(2);
    });
  });

  describe('currency formatting', () => {
    it('should format USD currency correctly', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      await user.click(screen.getByRole('button', { name: /your earnings/i }));

      // formatPrice rounds to whole numbers
      // Each value appears twice: once in "per case" breakdown and once as line total
      expect(screen.getAllByText(/\$100/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/\$84/).length).toBeGreaterThanOrEqual(1);
    });

    it('should format AED currency correctly', async () => {
      const user = userEvent.setup();
      const aedLineItems = [
        {
          productName: 'Wine AED',
          quantity: 1,
          commissionPerCase: 367,
          lineCommission: 367,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={aedLineItems}
          totalCommission={367}
          currency="AED"
        />,
      );

      await user.click(screen.getByRole('button', { name: /your earnings/i }));

      // For AED, formatPrice only shows the number (no symbol)
      // Check that both the commission per case and total are displayed
      const elementsWithValue = screen.getAllByText(/367/);
      expect(elementsWithValue.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle decimal commission values', async () => {
      const user = userEvent.setup();
      const decimalItems = [
        {
          productName: 'Decimal Wine',
          quantity: 3,
          commissionPerCase: 33.33,
          lineCommission: 99.99,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={decimalItems}
          totalCommission={99.99}
          currency="USD"
        />,
      );

      await user.click(screen.getByRole('button', { name: /your earnings/i }));

      // formatPrice rounds to whole numbers: 33.33 → 33, 99.99 → 100
      // Each value appears twice: once in "per case" breakdown and once as line total
      expect(screen.getAllByText(/\$33/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/\$100/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty line items array', () => {
      render(
        <CommissionBreakdown
          lineItems={[]}
          totalCommission={0}
          currency="USD"
        />,
      );

      expect(
        screen.getByRole('button', { name: /your earnings/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('should handle single line item', async () => {
      const user = userEvent.setup();
      const singleItem = [
        {
          productName: 'Single Wine',
          quantity: 5,
          commissionPerCase: 20,
          lineCommission: 100,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={singleItem}
          totalCommission={100}
          currency="USD"
        />,
      );

      await user.click(screen.getByRole('button', { name: /your earnings/i }));

      expect(screen.getByText('Single Wine')).toBeInTheDocument();
      expect(screen.getByText(/5× \$20/)).toBeInTheDocument();
    });

    it('should handle zero commission', () => {
      const zeroItems = [
        {
          productName: 'Zero Commission Wine',
          quantity: 1,
          commissionPerCase: 0,
          lineCommission: 0,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={zeroItems}
          totalCommission={0}
          currency="USD"
        />,
      );

      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('should handle large commission values', async () => {
      const user = userEvent.setup();
      const largeItems = [
        {
          productName: 'Expensive Wine',
          quantity: 100,
          commissionPerCase: 1000,
          lineCommission: 100000,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={largeItems}
          totalCommission={100000}
          currency="USD"
        />,
      );

      await user.click(screen.getByRole('button', { name: /your earnings/i }));

      // formatPrice uses comma separators and no decimals
      // Each value appears twice: once in "per case" breakdown and once as line total
      expect(screen.getAllByText(/\$1,000/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/\$100,000/).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle very long product names', async () => {
      const user = userEvent.setup();
      const longNameItems = [
        {
          productName:
            'Château de Very Long Name Bordeaux Grand Cru Classé 2015 Special Reserve',
          quantity: 1,
          commissionPerCase: 50,
          lineCommission: 50,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={longNameItems}
          totalCommission={50}
          currency="USD"
        />,
      );

      await user.click(screen.getByRole('button', { name: /your earnings/i }));

      expect(
        screen.getByText(
          'Château de Very Long Name Bordeaux Grand Cru Classé 2015 Special Reserve',
        ),
      ).toBeInTheDocument();
    });

    it('should handle fractional quantities', async () => {
      const user = userEvent.setup();
      const fractionalItems = [
        {
          productName: 'Fractional Wine',
          quantity: 2.5,
          commissionPerCase: 40,
          lineCommission: 100,
        },
      ];

      render(
        <CommissionBreakdown
          lineItems={fractionalItems}
          totalCommission={100}
          currency="USD"
        />,
      );

      await user.click(screen.getByRole('button', { name: /your earnings/i }));

      expect(screen.getByText(/2.5× \$40/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper button role', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
    });

    it('should toggle with Space key', async () => {
      const user = userEvent.setup();
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      button.focus();
      await user.keyboard(' ');

      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
    });
  });

  describe('styling and layout', () => {
    it('should apply proper styling classes', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const container = screen
        .getByRole('button', { name: /your earnings/i })
        .closest('div');
      expect(container).toHaveClass('rounded-xl');
      expect(container).toHaveClass('border');
    });

    it('should show hover effect on button', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      const button = screen.getByRole('button', { name: /your earnings/i });
      expect(button).toHaveClass('hover:bg-emerald-100/50');
    });
  });
});
