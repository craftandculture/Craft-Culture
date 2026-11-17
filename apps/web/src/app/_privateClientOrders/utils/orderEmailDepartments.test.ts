import { describe, expect, it } from 'vitest';

import contactDepartment from './contactDepartment';
import orderEmailDepartments from './orderEmailDepartments';
import type { OrderStatus } from './orderEmailTypes';

const status = (newStatus: OrderStatus, previousStatus: OrderStatus | null = null) =>
  orderEmailDepartments({ action: 'status_changed', newStatus, previousStatus });

describe('orderEmailDepartments', () => {
  it('sends client verification to Purchasing only', () => {
    expect(status('awaiting_distributor_verification', 'cc_approved')).toEqual(['purchasing']);
  });

  it('sends collect payment after verification to Finance only', () => {
    expect(status('awaiting_client_payment', 'awaiting_distributor_verification')).toEqual(['finance']);
  });

  it('sends a new, already verified order to both teams', () => {
    expect(status('awaiting_client_payment', 'cc_approved')).toEqual(['purchasing', 'finance']);
  });

  it('sends payment confirmation to Finance and dispatch to Purchasing', () => {
    expect(status('awaiting_payment_verification')).toEqual(['finance']);
    expect(status('stock_in_transit')).toEqual(['purchasing']);
  });

  it('sends notes and cancellations to both teams', () => {
    expect(orderEmailDepartments({ action: 'note_added', newStatus: null, previousStatus: null })).toEqual([
      'purchasing',
      'finance',
    ]);
    expect(status('cancelled')).toEqual(['purchasing', 'finance']);
  });
});

describe('contactDepartment', () => {
  it('reads the team from the role', () => {
    expect(contactDepartment('Purchasing')).toBe('purchasing');
    expect(contactDepartment('purchasing (order + SKU set-up)')).toBe('purchasing');
    expect(contactDepartment('Finance')).toBe('finance');
    expect(contactDepartment('Accounts')).toBe('finance');
    expect(contactDepartment('Operations Manager')).toBeNull();
    expect(contactDepartment(null)).toBeNull();
  });
});
