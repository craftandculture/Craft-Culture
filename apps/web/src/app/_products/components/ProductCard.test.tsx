import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ProductCard from './ProductCard';
import type { Product } from '../controller/productsGetMany';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    fill,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    className?: string;
    sizes?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill ? 'true' : undefined} {...props} />
  ),
}));

// Mock ProductDetailsPopover to simplify testing
vi.mock('./ProductDetailsPopover', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock LeadTimeBadge to avoid tRPC dependency
vi.mock('./LeadTimeBadge', () => ({
  default: ({ source }: { source: string }) => (
    <span data-testid="lead-time-badge">{source}</span>
  ),
}));

describe('ProductCard', () => {
  // Helper to create a test product
  const createProduct = (overrides: Partial<Product> = {}): Product => ({
    id: 'product-1',
    lwin18: '1234567890123456',
    name: 'Château Test 2020',
    producer: 'Test Producer',
    region: 'Bordeaux',
    country: 'France',
    year: 2020,
    imageUrl: 'https://example.com/wine.jpg',
    productOffers: [
      {
        id: 'offer-1',
        productId: 'product-1',
        externalId: 'ext-1',
        source: 'cultx',
        price: 100,
        currency: 'USD',
        unitCount: 12,
        unitSize: '750ml',
        availableQuantity: 100,
        inBondPriceUsd: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('rendering', () => {
    it('should render product card with all information', () => {
      const product = createProduct();
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText('Château Test 2020')).toBeInTheDocument();
      expect(screen.getByText('Test Producer')).toBeInTheDocument();
      expect(screen.getByText('Bordeaux')).toBeInTheDocument();
      expect(screen.getByText('2020')).toBeInTheDocument();
      expect(screen.getByText('12 × 750ml')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add to quote/i })).toBeInTheDocument();
    });

    it('should render product image when imageUrl is provided', () => {
      const product = createProduct({ imageUrl: 'https://example.com/wine.jpg' });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      const image = screen.getByAltText('Château Test 2020');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/wine.jpg');
    });

    it('should render placeholder icon when imageUrl is null', () => {
      const product = createProduct({ imageUrl: null });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      // Icon is rendered as svg
      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('should render placeholder icon when imageUrl is undefined', () => {
      const product = createProduct({ imageUrl: undefined });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.queryByAltText('Château Test 2020')).not.toBeInTheDocument();
      expect(document.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('currency display', () => {
    it('should display price in AED by default', () => {
      const product = createProduct({
        productOffers: [
          {
            id: 'offer-1',
            productId: 'product-1',
            externalId: 'ext-1',
            source: 'cultx',
            price: 100,
            currency: 'USD',
            unitCount: 12,
            unitSize: '750ml',
            availableQuantity: 100,
            inBondPriceUsd: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      // Price: 100 USD * 3.67 = 367 AED (with AED prefix)
      expect(screen.getByText('AED 367')).toBeInTheDocument();
    });

    it('should display price in USD when displayCurrency is USD', () => {
      const product = createProduct({
        productOffers: [
          {
            id: 'offer-1',
            productId: 'product-1',
            externalId: 'ext-1',
            source: 'cultx',
            price: 100,
            currency: 'USD',
            unitCount: 12,
            unitSize: '750ml',
            availableQuantity: 100,
            inBondPriceUsd: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} displayCurrency="USD" />);

      // Price formatted as $100 (en-GB locale format)
      expect(screen.getByText('$100')).toBeInTheDocument();
    });

    it('should handle zero price', () => {
      const product = createProduct({
        productOffers: [
          {
            id: 'offer-1',
            productId: 'product-1',
            externalId: 'ext-1',
            source: 'cultx',
            price: 0,
            currency: 'USD',
            unitCount: 12,
            unitSize: '750ml',
            availableQuantity: 100,
            inBondPriceUsd: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      // Price: 0 * 3.67 = 0 (with AED prefix)
      expect(screen.getByText('AED 0')).toBeInTheDocument();
    });
  });

  describe('product information display', () => {
    it('should display producer when present', () => {
      const product = createProduct({ producer: 'Domaine Test' });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText('Domaine Test')).toBeInTheDocument();
    });

    it('should not display producer section when producer is null', () => {
      const product = createProduct({ producer: null });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.queryByText('Test Producer')).not.toBeInTheDocument();
    });

    it('should display region when present', () => {
      const product = createProduct({ region: 'Burgundy' });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText('Burgundy')).toBeInTheDocument();
    });

    it('should not display region when region is null', () => {
      const product = createProduct({ region: null });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.queryByText('Bordeaux')).not.toBeInTheDocument();
    });

    it('should display vintage when year is present', () => {
      const product = createProduct({ year: 2018 });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText('2018')).toBeInTheDocument();
    });

    it('should display NV for non-vintage wine (year 0)', () => {
      const product = createProduct({ year: 0 });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText('NV')).toBeInTheDocument();
    });

    it('should not display year when year is null', () => {
      const product = createProduct({ year: null });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.queryByText('2020')).not.toBeInTheDocument();
      expect(screen.queryByText('NV')).not.toBeInTheDocument();
    });

    it('should display separator between region and year', () => {
      const product = createProduct({ region: 'Bordeaux', year: 2020 });
      const handleAdd = vi.fn();

      const { container } = render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(container.textContent).toMatch(/Bordeaux.*·.*2020/);
    });

    it('should not display separator when only region is present', () => {
      const product = createProduct({ region: 'Bordeaux', year: null });
      const handleAdd = vi.fn();

      const { container } = render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(container.textContent).not.toContain('·');
    });
  });

  describe('unit information', () => {
    it('should display unit count and size when offer exists', () => {
      const product = createProduct({
        productOffers: [
          {
            id: 'offer-1',
            productId: 'product-1',
            externalId: 'ext-1',
            source: 'cultx',
            price: 100,
            currency: 'USD',
            unitCount: 6,
            unitSize: '1.5L',
            availableQuantity: 50,
            inBondPriceUsd: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText('6 × 1.5L')).toBeInTheDocument();
    });

    it('should not display unit info when no offers', () => {
      const product = createProduct({ productOffers: [] });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    });

    it('should display per case label when offer exists', () => {
      const product = createProduct();
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText('per case')).toBeInTheDocument();
    });

    it('should not display per case when no offers', () => {
      const product = createProduct({ productOffers: [] });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.queryByText('per case')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onAdd with product when Add button is clicked', async () => {
      const user = userEvent.setup();
      const product = createProduct();
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      const addButton = screen.getByRole('button', { name: /add to quote/i });
      await user.click(addButton);

      expect(handleAdd).toHaveBeenCalledTimes(1);
      expect(handleAdd).toHaveBeenCalledWith(product);
    });

    it('should disable button when isAdding is true', () => {
      const product = createProduct();
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} isAdding />);

      const addButton = screen.getByRole('button', { name: /add to quote/i });
      expect(addButton).toHaveClass('opacity-50');
      expect(addButton).toHaveClass('pointer-events-none');
    });

    it('should not disable button when isAdding is false', () => {
      const product = createProduct();
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} isAdding={false} />);

      const addButton = screen.getByRole('button', { name: /add to quote/i });
      expect(addButton).not.toHaveClass('opacity-50');
    });
  });

  describe('edge cases', () => {
    it('should handle product with no offers', () => {
      const product = createProduct({ productOffers: [] });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      // Should still render the card
      expect(screen.getByText('Château Test 2020')).toBeInTheDocument();
      // Price should default to 0 (with AED prefix)
      expect(screen.getByText('AED 0')).toBeInTheDocument();
    });

    it('should handle very long product name', () => {
      const longName = 'Château Very Long Name That Should Be Truncated Because It Is Too Long For The Card Layout';
      const product = createProduct({ name: longName });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      expect(screen.getByText(longName)).toBeInTheDocument();
      expect(screen.getByText(longName)).toHaveClass('line-clamp-3');
    });

    it('should handle product with all optional fields null', () => {
      const product = createProduct({
        producer: null,
        region: null,
        year: null,
        imageUrl: null,
      });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} />);

      // Should still render with name and button
      expect(screen.getByText('Château Test 2020')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add to quote/i })).toBeInTheDocument();
    });

    it('should handle decimal prices correctly', () => {
      const product = createProduct({
        productOffers: [
          {
            id: 'offer-1',
            productId: 'product-1',
            externalId: 'ext-1',
            source: 'cultx',
            price: 99.99,
            currency: 'USD',
            unitCount: 12,
            unitSize: '750ml',
            availableQuantity: 100,
            inBondPriceUsd: 99.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const handleAdd = vi.fn();

      render(<ProductCard product={product} onAdd={handleAdd} displayCurrency="USD" />);

      // formatPrice rounds to whole numbers: 99.99 → $100
      expect(screen.getByText('$100')).toBeInTheDocument();
    });
  });
});
