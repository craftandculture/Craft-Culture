import { vi } from 'vitest';

import type { User } from '@/database/schema';

/**
 * Mock user data for testing
 */
export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  emailVerified: false,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customerType: 'b2c',
  companyName: null,
  companyLogo: null,
  companyAddress: null,
  companyPhone: null,
  companyEmail: null,
  companyWebsite: null,
  companyVatNumber: null,
  role: 'user',
  onboardingCompletedAt: null,
  pricingModelId: null,
  approvalStatus: 'approved',
  approvedAt: new Date(),
  approvedBy: null,
  termsAcceptedAt: null,
  lastViewedActivityAt: null,
};

/**
 * Mock admin user data for testing
 */
export const mockAdminUser: User = {
  ...mockUser,
  id: 'test-admin-id',
  email: 'admin@craftculture.xyz',
  role: 'admin',
};

/**
 * Mock tRPC context
 */
export const mockTRPCContext = () => ({
  user: mockUser,
  session: {
    id: 'test-session-id',
    userId: mockUser.id,
    expiresAt: new Date(Date.now() + 86400000),
    token: 'test-token',
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
  },
});

/**
 * Create a mock function with TypeScript type inference
 */
export const createMockFn = <T extends (...args: unknown[]) => unknown>() => {
  return vi.fn<T>();
};
