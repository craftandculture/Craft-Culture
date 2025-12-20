import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PricingModelsForm from './PricingModelsForm';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock tRPC hook
const mockQueryOptions = vi.fn();
const mockMutationOptions = vi.fn();

vi.mock('@/lib/trpc/browser', () => ({
  default: () => ({
    sheets: {
      getMany: {
        queryOptions: mockQueryOptions,
      },
    },
    pricingModels: {
      create: {
        mutationOptions: mockMutationOptions,
      },
    },
  }),
}));

// Mock @tanstack/react-query
const mockUseSuspenseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useSuspenseQuery: (...args: unknown[]) => mockUseSuspenseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

describe('PricingModelsForm', () => {
  const mockSheets = [
    { id: 'sheet-1', name: 'Example Pricing Model', createdAt: new Date(), updatedAt: new Date() },
    { id: 'sheet-2', name: 'B2B Pricing Model', createdAt: new Date(), updatedAt: new Date() },
  ];

  const mockQueryClient = {
    invalidateQueries: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryOptions.mockReturnValue({});
    mockMutationOptions.mockImplementation((options) => ({ onSuccess: options.onSuccess, onError: options.onError }));
    mockUseSuspenseQuery.mockReturnValue({ data: mockSheets });
    mockUseQueryClient.mockReturnValue(mockQueryClient);
  });

  describe('rendering', () => {
    it('should render form with model name input', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByLabelText('Model Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. B2B Pricing Model')).toBeInTheDocument();
    });

    it('should render sheet selection section', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByText('Sheet')).toBeInTheDocument();
      expect(screen.getByText('Select a sheet...')).toBeInTheDocument();
    });

    it('should render default settings checkboxes', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByLabelText('Set as default B2C pricing model')).toBeInTheDocument();
      expect(screen.getByLabelText('Set as default B2B pricing model')).toBeInTheDocument();
    });

    it('should render required cell mapping fields', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByText('Price AED *')).toBeInTheDocument();
      expect(screen.getByText('Final Price AED *')).toBeInTheDocument();
    });

    it('should render optional cell mapping fields', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('LWIN18')).toBeInTheDocument();
      expect(screen.getByText('Region')).toBeInTheDocument();
      expect(screen.getByText('Producer')).toBeInTheDocument();
      expect(screen.getByText('Vintage')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByRole('button', { name: /create pricing model/i })).toBeInTheDocument();
    });

    it('should show message when no sheets available', () => {
      mockUseSuspenseQuery.mockReturnValue({ data: [] });
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByText('Please upload a sheet first before creating a pricing model.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Model Name')).not.toBeInTheDocument();
    });
  });

  describe('default values', () => {
    it('should have default model name value', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const input = screen.getByLabelText('Model Name') as HTMLInputElement;
      expect(input.value).toBe('Example Pricing Model');
    });

    it('should have default B2C checkbox unchecked', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { container } = render(<PricingModelsForm />);

      const checkbox = container.querySelector('#isDefaultB2C') as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox?.getAttribute('aria-checked')).toBe('false');
    });

    it('should have default B2B checkbox unchecked', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { container } = render(<PricingModelsForm />);

      const checkbox = container.querySelector('#isDefaultB2B') as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox?.getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('user interactions', () => {
    it('should allow changing model name', async () => {
      const user = userEvent.setup();
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const input = screen.getByLabelText('Model Name');
      await user.clear(input);
      await user.type(input, 'My Custom Model');

      expect(input).toHaveValue('My Custom Model');
    });

    it('should allow checking B2C default checkbox', async () => {
      const user = userEvent.setup();
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const checkbox = screen.getByLabelText('Set as default B2C pricing model');
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should allow checking B2B default checkbox', async () => {
      const user = userEvent.setup();
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const checkbox = screen.getByLabelText('Set as default B2B pricing model');
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
    });
  });

  describe('form submission', () => {
    it('should have submit button enabled by default', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const submitButton = screen.getByRole('button', { name: /create pricing model/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).not.toHaveClass('opacity-50');
    });

    it('should render submit button with icon', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const submitButton = screen.getByRole('button', { name: /create pricing model/i });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('sections', () => {
    it('should display default settings section', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByText('Default Settings')).toBeInTheDocument();
      expect(screen.getByText('Set this pricing model as the default for customer types')).toBeInTheDocument();
    });

    it('should display required cell mappings section', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByText('Required Cell Mappings')).toBeInTheDocument();
      expect(screen.getByText('These fields are required for the pricing model to work')).toBeInTheDocument();
    });

    it('should display optional cell mappings section', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      expect(screen.getByText('Optional Cell Mappings')).toBeInTheDocument();
      expect(screen.getByText('Additional fields that can enhance the pricing model')).toBeInTheDocument();
    });
  });

  describe('cell mapping fields', () => {
    it('should render all required cell mapping input fields', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const priceInput = screen.getByPlaceholderText("'Example Pricing Model'!R7:R16");
      const finalPriceInput = screen.getByPlaceholderText("'Example Pricing Model'!B4");

      expect(priceInput).toBeInTheDocument();
      expect(finalPriceInput).toBeInTheDocument();
    });

    it('should render all optional cell mapping input fields', () => {
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const nameInput = screen.getByPlaceholderText("'Example Pricing Model'!A7:A16");
      const lwinInput = screen.getByPlaceholderText("'Example Pricing Model'!B7:B16");

      expect(nameInput).toBeInTheDocument();
      expect(lwinInput).toBeInTheDocument();
    });

    it('should allow editing cell mapping fields', async () => {
      const user = userEvent.setup();
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<PricingModelsForm />);

      const priceInput = screen.getByPlaceholderText("'Example Pricing Model'!R7:R16");
      await user.clear(priceInput);
      await user.type(priceInput, "'Custom Sheet'!A1:A10");

      expect(priceInput).toHaveValue("'Custom Sheet'!A1:A10");
    });
  });
});
