'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'recently-viewed-products';
const MAX_ITEMS = 6;

interface RecentlyViewedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  timestamp: number;
}

/**
 * Hook to track and retrieve recently viewed products
 * Persists to localStorage and limits to MAX_ITEMS
 *
 * @example
 *   const { recentlyViewed, addToRecentlyViewed, clearRecentlyViewed } = useRecentlyViewed();
 */
const useRecentlyViewed = () => {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentlyViewedProduct[];
        setRecentlyViewed(parsed);
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  const addToRecentlyViewed = useCallback(
    (product: { id: string; name: string; imageUrl: string | null | undefined }) => {
      setRecentlyViewed((prev) => {
        // Remove if already exists (to move to front)
        const filtered = prev.filter((p) => p.id !== product.id);

        // Add to front with timestamp
        const updated = [
          {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl ?? null,
            timestamp: Date.now(),
          },
          ...filtered,
        ].slice(0, MAX_ITEMS);

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }

        return updated;
      });
    },
    [],
  );

  const clearRecentlyViewed = useCallback(() => {
    setRecentlyViewed([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    recentlyViewed,
    addToRecentlyViewed,
    clearRecentlyViewed,
  };
};

export default useRecentlyViewed;
