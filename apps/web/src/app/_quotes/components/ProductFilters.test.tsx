import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProductFilters from './ProductFilters';

// Mock useQueryStates
const mockSetFilters = vi.fn();
const mockFilters: {
  countries: string[];
  regions: string[];
  producers: string[];
  vintages: number[];
} = {
  countries: [],
  regions: [],
  producers: [],
  vintages: [],
};

vi.mock('nuqs', () => ({
  useQueryStates: () => [mockFilters, mockSetFilters],
}));

describe('ProductFilters', () => {
  const mockCountriesWithCounts = [
    { value: 'France', count: 100 },
    { value: 'Italy', count: 75 },
    { value: 'Spain', count: 50 },
  ];

  const mockRegionsByCountryWithCounts = {
    France: [
      { value: 'Bordeaux', count: 50 },
      { value: 'Burgundy', count: 30 },
    ],
    Italy: [
      { value: 'Tuscany', count: 40 },
    ],
  };

  const mockProducersByCountryWithCounts = {
    France: [
      { value: 'Château Margaux', count: 10, regions: ['Bordeaux'] },
      { value: 'Domaine de la Romanée-Conti', count: 8, regions: ['Burgundy'] },
    ],
    Italy: [
      { value: 'Antinori', count: 15, regions: ['Tuscany'] },
    ],
  };

  const mockVintagesByCountryWithCounts = {
    France: [
      { value: 2020, count: 30 },
      { value: 2019, count: 25 },
      { value: 0, count: 5 }, // NV
    ],
    Italy: [
      { value: 2021, count: 20 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFilters.countries = [];
    mockFilters.regions = [];
    mockFilters.producers = [];
    mockFilters.vintages = [];
  });

  describe('rendering', () => {
    it('should render filter button', () => {
      render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    });

    it('should render filter sections after expanding', async () => {
      const user = userEvent.setup();
      render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      await user.click(screen.getByRole('button', { name: /filters/i }));

      // Check that filter section headers exist (using getAllByText since there are multiple elements with these texts)
      expect(screen.getAllByText('Country').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Region').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Producer').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Vintage').length).toBeGreaterThan(0);
    });

    it('should not show clear button when no filters active', () => {
      render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });
  });

  describe('filter expansion', () => {
    it('should expand and collapse filters on button click', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      const filterButton = screen.getByRole('button', { name: /filters/i });

      // Initially collapsed
      let filterContainer = container.querySelector('[class*="max-h-0"]');
      expect(filterContainer).toBeInTheDocument();

      // Expand
      await user.click(filterButton);
      filterContainer = container.querySelector('[class*="max-h-\\[800px\\]"]');
      expect(filterContainer).toBeInTheDocument();
    });
  });

  describe('clear filters', () => {
    it('should show clear button when filters are active', () => {
      mockFilters.countries = ['France'];

      render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      // Clear button should exist (there are multiple - one for mobile, one for desktop)
      const clearButtons = screen.getAllByRole('button', { name: /clear/i });
      expect(clearButtons.length).toBeGreaterThan(0);
    });

    it('should clear all filters when clicked', async () => {
      const user = userEvent.setup();
      mockFilters.countries = ['France'];
      mockFilters.regions = ['Bordeaux'];

      render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      const clearButtons = screen.getAllByRole('button', { name: /clear/i });
      await user.click(clearButtons[0]!);

      expect(mockSetFilters).toHaveBeenCalledWith({
        countries: [],
        regions: [],
        producers: [],
        vintages: [],
      });
    });
  });

  describe('active filter count', () => {
    it('should show count badge when filters are active', () => {
      mockFilters.countries = ['France', 'Italy'];
      mockFilters.regions = ['Bordeaux'];

      const { container } = render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      // Should show count badge
      const badge = container.querySelector('[class*="bg-fill-accent"]');
      expect(badge).toBeInTheDocument();
    });

    it('should not show count badge when no filters are active', () => {
      const { container } = render(
        <ProductFilters
          countriesWithCounts={mockCountriesWithCounts}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      const badge = container.querySelector('[class*="bg-fill-accent"]');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should show search input for countries when count > 5', async () => {
      const user = userEvent.setup();
      const manyCountries = Array.from({ length: 10 }, (_, i) => ({
        value: `Country ${i}`,
        count: 10,
      }));

      render(
        <ProductFilters
          countriesWithCounts={manyCountries}
          regionsByCountryWithCounts={mockRegionsByCountryWithCounts}
          producersByCountryWithCounts={mockProducersByCountryWithCounts}
          vintagesByCountryWithCounts={mockVintagesByCountryWithCounts}
        />
      );

      await user.click(screen.getByRole('button', { name: /filters/i }));

      const searchInputs = screen.getAllByPlaceholderText('Search...');
      expect(searchInputs.length).toBeGreaterThan(0);
    });
  });

  describe('empty filter data', () => {
    it('should handle empty countries gracefully', async () => {
      const user = userEvent.setup();
      render(
        <ProductFilters
          countriesWithCounts={[]}
          regionsByCountryWithCounts={{}}
          producersByCountryWithCounts={{}}
          vintagesByCountryWithCounts={{}}
        />
      );

      await user.click(screen.getByRole('button', { name: /filters/i }));

      // When there are no countries, it should show "None available"
      const noneAvailableText = screen.getAllByText('None available');
      expect(noneAvailableText.length).toBeGreaterThan(0);
    });
  });
});
