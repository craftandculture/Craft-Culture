import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import QuotesForm from './QuotesForm';

// Mock child components to simplify testing
vi.mock('./LineItemRow', () => ({
  default: () => <div data-testid="line-item-row">Line Item</div>,
}));

vi.mock('./ProductFilters', () => ({
  default: () => <div data-testid="product-filters">Product Filters</div>,
}));

vi.mock('@/app/_products/components/CatalogBrowser', () => ({
  default: () => <div data-testid="catalog-browser">Catalog Browser</div>,
}));

vi.mock('./PriceInfoTooltip', () => ({
  default: () => null,
}));

vi.mock('../utils/exportQuoteToExcel', () => ({
  default: vi.fn(),
}));

vi.mock('../utils/exportInventoryToExcel', () => ({
  default: vi.fn(),
}));

// Mock useQueryState and useQueryStates
vi.mock('nuqs', () => ({
  parseAsArrayOf: () => ({ withDefault: (val: unknown) => val }),
  parseAsJson: () => ({}),
  parseAsNativeArrayOf: () => ({ withDefault: (val: unknown) => val }),
  useQueryState: () => [[], vi.fn()],
  useQueryStates: () => [{ countries: [], regions: [], producers: [], vintages: [] }],
}));

// Mock useTRPC and useTRPCClient hooks
vi.mock('@/lib/trpc/browser', () => ({
  default: () => ({
    users: {
      getMe: {
        queryOptions: vi.fn(() => ({
          queryKey: ['users.getMe'],
          queryFn: () => Promise.resolve(null),
        })),
      },
    },
    products: {
      getFilterOptions: {
        queryOptions: vi.fn(() => ({
          queryKey: ['products.getFilterOptions'],
          queryFn: () => Promise.resolve({}),
        })),
      },
      getMany: {
        queryOptions: vi.fn(() => ({
          queryKey: ['products.getMany'],
          queryFn: () => Promise.resolve({ items: [], total: 0 }),
        })),
      },
      getLastUpdate: {
        queryOptions: vi.fn(() => ({
          queryKey: ['products.getLastUpdate'],
          queryFn: () => Promise.resolve(null),
        })),
      },
    },
    quotes: {
      get: {
        queryOptions: vi.fn(() => ({
          queryKey: ['quotes.get'],
          queryFn: () => Promise.resolve(null),
        })),
      },
    },
    admin: {
      settings: {
        get: {
          queryOptions: vi.fn(() => ({
            queryKey: ['admin.settings.get'],
            queryFn: () => Promise.resolve({ value: '7' }),
          })),
        },
      },
    },
  }),
  useTRPCClient: () => ({
    quotes: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
  }),
}));

describe('QuotesForm', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const { container } = renderWithProviders(<QuotesForm />);
      expect(container).toBeInTheDocument();
    });

    it('should render main sections', () => {
      const { getByText } = renderWithProviders(<QuotesForm />);

      // Check for main section headers
      expect(getByText('Quotation Builder')).toBeInTheDocument();
      expect(getByText('Product Catalogue')).toBeInTheDocument();
    });

    it('should render catalog browser', () => {
      const { getByTestId } = renderWithProviders(<QuotesForm />);

      expect(getByTestId('catalog-browser')).toBeInTheDocument();
    });

    it('should render currency toggle', () => {
      const { getByText } = renderWithProviders(<QuotesForm />);

      expect(getByText('Currency:')).toBeInTheDocument();
      expect(getByText('USD')).toBeInTheDocument();
      expect(getByText('AED')).toBeInTheDocument();
    });

    it('should render total section', () => {
      const { getByText } = renderWithProviders(<QuotesForm />);

      expect(getByText('Total')).toBeInTheDocument();
    });
  });
});
