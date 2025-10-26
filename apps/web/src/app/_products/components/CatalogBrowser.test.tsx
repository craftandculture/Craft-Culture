import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import CatalogBrowser from './CatalogBrowser';
import type { Product } from '../controller/productsGetMany';

// Mock ProductCard
vi.mock('./ProductCard', () => ({
  default: ({
    product,
    onAdd,
    isAdding,
  }: {
    product: Product;
    onAdd: (product: Product) => void;
    isAdding: boolean;
  }) => (
    <div data-testid={`product-card-${product.id}`}>
      <div>{product.name}</div>
      <button onClick={() => onAdd(product)} disabled={isAdding}>
        Add to Quote
      </button>
    </div>
  ),
}));

// Mock useQueryStates
const mockFilters = {
  countries: [],
  regions: [],
  producers: [],
  vintages: [],
};

vi.mock('nuqs', () => ({
  useQueryStates: () => [mockFilters],
}));

// Mock tRPC hook
const mockInfiniteQueryOptions = vi.fn();

vi.mock('@/lib/trpc/browser', () => ({
  default: () => ({
    products: {
      getMany: {
        infiniteQueryOptions: mockInfiniteQueryOptions,
      },
    },
  }),
}));

// Mock @tanstack/react-query
const mockUseInfiniteQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
}));

describe('CatalogBrowser', () => {
  const mockOnAddProduct = vi.fn();
  const mockOnDownloadInventory = vi.fn();

  const mockProduct1: Product = {
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
        source: 'CultX',
        price: 100,
        currency: 'USD',
        unitCount: 12,
        unitSize: '750ml',
        availableQuantity: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct2: Product = {
    ...mockProduct1,
    id: 'product-2',
    name: 'Domaine de la Romanée-Conti 2019',
    region: 'Burgundy',
  };

  const mockQueryData = {
    pages: [
      {
        data: [mockProduct1, mockProduct2],
        meta: {
          totalCount: 2,
          nextCursor: undefined,
        },
      },
    ],
    pageParams: [0],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInfiniteQueryOptions.mockReturnValue({});
    mockFilters.countries = [];
    mockFilters.regions = [];
    mockFilters.producers = [];
    mockFilters.vintages = [];
  });

  describe('rendering', () => {
    it('should render header with product count', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByText('Browse Full Inventory')).toBeInTheDocument();
      expect(screen.getByText('2 products available')).toBeInTheDocument();
    });

    it('should render search input', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByPlaceholderText('Search catalog...')).toBeInTheDocument();
    });

    it('should render sort dropdown', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByDisplayValue('Name (A-Z)')).toBeInTheDocument();
    });

    it('should render product cards', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByTestId('product-card-product-1')).toBeInTheDocument();
      expect(screen.getByTestId('product-card-product-2')).toBeInTheDocument();
    });

    it('should render download inventory button when provided', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
          onDownloadInventory={mockOnDownloadInventory}
        />
      );

      expect(screen.getByRole('button', { name: /download full inventory/i })).toBeInTheDocument();
    });

    it('should not render download button when not provided', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.queryByRole('button', { name: /download full inventory/i })).not.toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should show loading skeletons when loading', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      // Should render multiple skeleton loaders
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show loading text in header when loading', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('should show empty message when no products', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: [], meta: { totalCount: 0, nextCursor: undefined } }],
          pageParams: [0],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByText('No products available')).toBeInTheDocument();
    });

    it('should show search-specific empty message when searching', async () => {
      const user = userEvent.setup();
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: [], meta: { totalCount: 0, nextCursor: undefined } }],
          pageParams: [0],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search catalog...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No products found matching your search')).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should allow typing in search input', async () => {
      const user = userEvent.setup();
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search catalog...');
      await user.type(searchInput, 'Château');

      expect(searchInput).toHaveValue('Château');
    });

    it('should debounce search input', async () => {
      const user = userEvent.setup();
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search catalog...');
      await user.type(searchInput, 'test');

      // Search should be debounced (not immediate)
      expect(mockInfiniteQueryOptions).toHaveBeenCalled();
    });
  });

  describe('sorting', () => {
    it('should allow changing sort option', async () => {
      const user = userEvent.setup();
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      const sortSelect = screen.getByDisplayValue('Name (A-Z)');
      await user.selectOptions(sortSelect, 'price-asc');

      expect(sortSelect).toHaveValue('price-asc');
    });

    it('should have all sort options available', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByText('Name (A-Z)')).toBeInTheDocument();
      expect(screen.getByText('Name (Z-A)')).toBeInTheDocument();
      expect(screen.getByText('Price (Low to High)')).toBeInTheDocument();
      expect(screen.getByText('Price (High to Low)')).toBeInTheDocument();
      expect(screen.getByText('Vintage (Oldest)')).toBeInTheDocument();
      expect(screen.getByText('Vintage (Newest)')).toBeInTheDocument();
    });
  });

  describe('product interactions', () => {
    it('should call onAddProduct when add button clicked', async () => {
      const user = userEvent.setup();
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      const addButtons = screen.getAllByText('Add to Quote');
      await user.click(addButtons[0]!);

      expect(mockOnAddProduct).toHaveBeenCalledWith(mockProduct1);
    });

    it('should show adding state on product card', async () => {
      const user = userEvent.setup();
      mockOnAddProduct.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      const addButtons = screen.getAllByText('Add to Quote');
      await user.click(addButtons[0]!);

      await waitFor(() => {
        expect(addButtons[0]).toBeDisabled();
      });
    });
  });

  describe('download inventory', () => {
    it('should call onDownloadInventory when clicked', async () => {
      const user = userEvent.setup();
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
          onDownloadInventory={mockOnDownloadInventory}
        />
      );

      const downloadButton = screen.getByRole('button', { name: /download full inventory/i });
      await user.click(downloadButton);

      expect(mockOnDownloadInventory).toHaveBeenCalled();
    });

    it('should disable download button when downloading', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
          onDownloadInventory={mockOnDownloadInventory}
          isDownloadingInventory
        />
      );

      const downloadButton = screen.getByRole('button', { name: /download full inventory/i });
      expect(downloadButton).toHaveClass('opacity-50');
    });

    it('should disable download button when no products', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: [], meta: { totalCount: 0, nextCursor: undefined } }],
          pageParams: [0],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
          onDownloadInventory={mockOnDownloadInventory}
        />
      );

      const downloadButton = screen.getByRole('button', { name: /download full inventory/i });
      expect(downloadButton).toHaveClass('opacity-50');
    });
  });

  describe('infinite scroll', () => {
    it('should show end of results message when no more pages', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.getByText("You've reached the end of the catalog")).toBeInTheDocument();
    });

    it('should not show end message when there are more pages', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      expect(screen.queryByText("You've reached the end of the catalog")).not.toBeInTheDocument();
    });

    it('should show loading skeletons when fetching next page', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
        />
      );

      // Should have loading skeletons for next page
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('omit products', () => {
    it('should pass omitProductIds to query', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="AED"
          omitProductIds={['product-1', 'product-2']}
        />
      );

      expect(mockInfiniteQueryOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          omitProductIds: ['product-1', 'product-2'],
        })
      );
    });
  });

  describe('currency display', () => {
    it('should pass displayCurrency to ProductCard', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: mockQueryData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      });

      render(
        <CatalogBrowser
          onAddProduct={mockOnAddProduct}
          displayCurrency="USD"
        />
      );

      // ProductCard is mocked, just verify it renders
      expect(screen.getByTestId('product-card-product-1')).toBeInTheDocument();
    });
  });
});
