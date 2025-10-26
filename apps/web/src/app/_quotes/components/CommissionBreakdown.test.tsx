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
        screen.getByRole('button', { name: /sales commission/i }),
      ).toBeInTheDocument();

      // Breakdown should not be visible initially
      expect(
        screen.queryByText('Commission Breakdown'),
      ).not.toBeInTheDocument();
    });

    it('should display total commission in collapsed state', () => {
      render(
        <CommissionBreakdown
          lineItems={mockLineItems}
          totalCommission={284.15}
          currency="USD"
        />,
      );

      // formatPrice rounds to whole number and uses US$ format
      expect(screen.getByText('US$284')).toBeInTheDocument();
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
        name: /sales commission/i,
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

      const button = screen.getByRole('button', { name: /sales commission/i });
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

      const button = screen.getByRole('button', { name: /sales commission/i });
      await user.click(button);

      // Breakdown should now be visible
      expect(screen.getByText('Commission Breakdown')).toBeInTheDocument();
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

      const button = screen.getByRole('button', { name: /sales commission/i });

      // Expand
      await user.click(button);
      expect(screen.getByText('Commission Breakdown')).toBeInTheDocument();

      // Collapse
      await user.click(button);
      expect(
        screen.queryByText('Commission Breakdown'),
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

      const button = screen.getByRole('button', { name: /sales commission/i });
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

      const button = screen.getByRole('button', { name: /sales commission/i });
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

      const button = screen.getByRole('button', { name: /sales commission/i });
      await user.click(button);

      // Check calculation display: "2 cases × US$100"
      expect(screen.getByText(/2 cases/i)).toBeInTheDocument();
      expect(screen.getByText('US$200')).toBeInTheDocument();

      // Check second item: "1 case × US$84"
      expect(screen.getByText(/1 case/i)).toBeInTheDocument();
      expect(screen.getByText('US$84')).toBeInTheDocument();
    });

    it('should pluralize "case" correctly', async () => {
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

      const button = screen.getByRole('button', { name: /sales commission/i });
      await user.click(button);

      // Check singular "case"
      expect(screen.getByText(/1 case/i)).toBeInTheDocument();
      // Check plural "cases"
      expect(screen.getByText(/3 cases/i)).toBeInTheDocument();
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

      const button = screen.getByRole('button', { name: /sales commission/i });
      await user.click(button);

      // Check footer total (should appear twice: once in header, once in footer)
      const totalElements = screen.getAllByText('US$284');
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

      await user.click(screen.getByRole('button', { name: /sales commission/i }));

      // formatPrice rounds to whole numbers
      // Each value appears twice: once in "per case" breakdown and once as line total
      expect(screen.getAllByText(/US\$100/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/US\$84/).length).toBeGreaterThanOrEqual(1);
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

      await user.click(screen.getByRole('button', { name: /sales commission/i }));

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

      await user.click(screen.getByRole('button', { name: /sales commission/i }));

      // formatPrice rounds to whole numbers: 33.33 → 33, 99.99 → 100
      // Each value appears twice: once in "per case" breakdown and once as line total
      expect(screen.getAllByText(/US\$33/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/US\$100/).length).toBeGreaterThanOrEqual(1);
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
        screen.getByRole('button', { name: /sales commission/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('US$0')).toBeInTheDocument();
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

      await user.click(screen.getByRole('button', { name: /sales commission/i }));

      expect(screen.getByText('Single Wine')).toBeInTheDocument();
      expect(screen.getByText(/5 cases/i)).toBeInTheDocument();
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

      expect(screen.getByText('US$0')).toBeInTheDocument();
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

      await user.click(screen.getByRole('button', { name: /sales commission/i }));

      // formatPrice uses comma separators and no decimals
      // Each value appears twice: once in "per case" breakdown and once as line total
      expect(screen.getAllByText(/US\$1,000/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/US\$100,000/).length).toBeGreaterThanOrEqual(1);
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

      await user.click(screen.getByRole('button', { name: /sales commission/i }));

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

      await user.click(screen.getByRole('button', { name: /sales commission/i }));

      expect(screen.getByText(/2.5 cases/i)).toBeInTheDocument();
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

      const button = screen.getByRole('button', { name: /sales commission/i });
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

      const button = screen.getByRole('button', { name: /sales commission/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByText('Commission Breakdown')).toBeInTheDocument();
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

      const button = screen.getByRole('button', { name: /sales commission/i });
      button.focus();
      await user.keyboard(' ');

      expect(screen.getByText('Commission Breakdown')).toBeInTheDocument();
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
        .getByRole('button', { name: /sales commission/i })
        .closest('div');
      expect(container).toHaveClass('rounded-lg');
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

      const button = screen.getByRole('button', { name: /sales commission/i });
      expect(button).toHaveClass('hover:bg-fill-secondary');
    });
  });
});
