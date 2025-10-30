import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-only';
process.env.DB_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
process.env.LOOPS_API_KEY = 'test-loops-key';
process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
