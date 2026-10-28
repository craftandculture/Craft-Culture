import { describe, expect, it } from 'vitest';

import fileHref from './fileHref';

describe('fileHref', () => {
  it('opens a private file through the checked route', () => {
    expect(
      fileHref(
        'https://gasgxoqd6n5v8ara.private.blob.vercel-storage.com/payment-proofs/u1/proof-x.pdf',
      ),
    ).toBe('/api/files/payment-proofs/u1/proof-x.pdf');
  });

  it('leaves a public file as it is', () => {
    const url =
      'https://wejmklxaljhoatsp.public.blob.vercel-storage.com/a/b.pdf';
    expect(fileHref(url)).toBe(url);
  });

  it('passes empty values through', () => {
    expect(fileHref(null)).toBeNull();
    expect(fileHref('')).toBe('');
  });
});
