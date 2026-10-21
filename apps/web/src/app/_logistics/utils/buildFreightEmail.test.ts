import { describe, expect, it } from 'vitest';

import buildFreightEmail from './buildFreightEmail';
import type { FreightEmailForwarder, FreightEmailQuote, FreightEmailRequest } from './buildFreightEmail';

const request: FreightEmailRequest = {
  requestNumber: 'QRQ-2026-0012',
  originCountry: 'United Kingdom',
  originCity: 'Burton upon Trent',
  originWarehouse: 'LCB Burton Gateway',
  destinationCountry: 'United Arab Emirates',
  destinationCity: 'Ras Al Khaimah',
  destinationWarehouse: 'C&C bonded warehouse',
  transportMode: null,
  productType: 'wine',
  productDescription: null,
  totalCases: 193,
  totalBottles: 993,
  total75clEquivalents: 1111.3,
  totalPallets: 3,
  totalWeightKg: 1600,
  totalVolumeM3: 2.9,
  temperatureControlled: true,
  requiresThermalLiner: false,
  requiresTracker: false,
  requiresInsurance: true,
  minTemperature: 12,
  maxTemperature: 16,
  targetPickupDate: null,
  targetDeliveryDate: null,
  replyBy: new Date('2026-10-28T08:00:00Z'),
  notes: null,
};

const hillebrand: FreightEmailForwarder = {
  name: 'Hillebrand',
  contacts: [{ name: 'Anna Smith', email: 'anna@hillebrand.com' }],
};
const albatrans: FreightEmailForwarder = { name: 'Albatrans', contacts: [{ email: 'quotes@albatrans.co.uk' }] };

const quote: FreightEmailQuote = {
  quoteNumber: 'QTE-2026-0040',
  forwarderReference: 'HB-77812',
  totalPrice: 2140,
  currency: 'gbp',
  transitDays: 9,
  validUntil: new Date('2026-11-15T08:00:00Z'),
  categories: ['Freight', 'Origin Handling', 'Documentation'],
};

const all = [
  buildFreightEmail({ kind: 'request', request, forwarders: [hillebrand], senderName: 'Jyothi' }),
  buildFreightEmail({ kind: 'chase', request, forwarders: [hillebrand], senderName: 'Jyothi' }),
  buildFreightEmail({ kind: 'award', request, forwarder: hillebrand, quote, senderName: 'Jyothi' }),
  buildFreightEmail({ kind: 'decline', request, forwarder: albatrans, quote, senderName: 'Jyothi' }),
  buildFreightEmail({ kind: 'client_quote', request, quote, clientPriceUsd: 3200, senderName: 'Kevin' }),
];

describe('buildFreightEmail', () => {
  it('carries the request number in every subject', () => {
    for (const email of all) expect(email.subject).toContain('QRQ-2026-0012');
  });

  it('uses no contractions', () => {
    for (const email of all) expect(`${email.subject}\n${email.body}`).not.toMatch(/\b\w+'(t|s|re|ll|ve|d)\b/i);
  });

  it('addresses one forwarder directly and several in Bcc', () => {
    const one = all[0]!;
    const many = buildFreightEmail({ kind: 'request', request, forwarders: [hillebrand, albatrans], senderName: 'Jyothi' });

    expect(one.to).toEqual(['anna@hillebrand.com']);
    expect(one.body.startsWith('Dear Anna,')).toBe(true);
    expect(many.to).toEqual([]);
    expect(many.bcc).toEqual(['anna@hillebrand.com', 'quotes@albatrans.co.uk']);
    expect(many.body.startsWith('Dear Sir or Madam,')).toBe(true);
  });

  it('describes the cargo, requirements and reply date in a request', () => {
    const { body } = all[0]!;

    expect(body).toContain('- Quantity: 193 cases, 993 bottles (1,111 × 75cl equivalent)');
    expect(body).toContain('- Mode: Air and sea options');
    expect(body).toContain('Temperature-managed throughout (12–16°C)');
    expect(body).toContain('Transit insurance, shown as a separate line');
    expect(body).toContain('by 28 October 2026');
  });

  it('quotes the forwarder reference back when awarding', () => {
    expect(all[2]!.subject).toContain('HB-77812');
    expect(all[2]!.body).toContain('GBP 2,140.00');
  });

  it('never shows the client the forwarder, its price or the warehouse location', () => {
    const { body, subject, to } = all[4]!;
    const text = `${subject}\n${body}`;

    expect(to).toEqual([]);
    expect(text).not.toMatch(/hillebrand|HB-77812|2,140|QTE-|Ras Al Khaimah|RAK/i);
    expect(body).toContain('USD 3,200.00 (USD 3.22 per bottle)');
    expect(body).toContain('the C&C bonded warehouse, United Arab Emirates');
    expect(body).toContain('Includes: freight, collection and origin handling, export documentation');
    expect(body).toContain('transit insurance can be arranged on request');
  });
});
