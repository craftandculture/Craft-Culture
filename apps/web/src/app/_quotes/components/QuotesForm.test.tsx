import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  useQueryState: () => [[], vi.fn()],
  useQueryStates: () => [{ countries: [], regions: [], producers: [], vintages: [] }],
}));

// Mock tRPC
vi.mock('@/lib/trpc/browser', () => ({
  default: () => ({
    users: {
      getMe: {
        queryOptions: () => ({}),
      },
    },
    products: {
      getFilterOptions: {
        queryOptions: () => ({}),
      },
      getMany: {
        queryOptions: () => ({}),
      },
      getLastUpdate: {
        queryOptions: () => ({}),
      },
    },
    quotes: {
      get: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

describe('QuotesForm', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<QuotesForm />);
      expect(container).toBeInTheDocument();
    });

    it('should render main sections', () => {
      const { getByText } = render(<QuotesForm />);

      // Check for main section headers
      expect(getByText('Quotation Builder')).toBeInTheDocument();
      expect(getByText('Product Catalogue')).toBeInTheDocument();
    });

    it('should render catalog browser', () => {
      const { getByTestId } = render(<QuotesForm />);

      expect(getByTestId('catalog-browser')).toBeInTheDocument();
    });

    it('should render currency toggle', () => {
      const { getByText } = render(<QuotesForm />);

      expect(getByText('Currency:')).toBeInTheDocument();
      expect(getByText('USD')).toBeInTheDocument();
      expect(getByText('AED')).toBeInTheDocument();
    });

    it('should render total section', () => {
      const { getByText } = render(<QuotesForm />);

      expect(getByText('Total')).toBeInTheDocument();
    });
  });
});
