import { randomBytes } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import decryptIdentityFile from './decryptIdentityFile';
import encryptIdentityFile from './encryptIdentityFile';

const original = process.env.IDENTITY_ENCRYPTION_KEY;

afterEach(() => {
  process.env.IDENTITY_ENCRYPTION_KEY = original;
});

describe('identity file encryption', () => {
  it('round-trips, and the stored bytes are not the original', () => {
    process.env.IDENTITY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    const plain = Buffer.from('a government ID');

    const { bytes, encrypted } = encryptIdentityFile(plain);

    expect(encrypted).toBe(true);
    expect(bytes.includes(plain)).toBe(false);
    expect(decryptIdentityFile(bytes).equals(plain)).toBe(true);
  });

  it('stores as before when no key is set, and reads legacy files unchanged', () => {
    delete process.env.IDENTITY_ENCRYPTION_KEY;
    const plain = Buffer.from('uploaded before encryption');

    const { bytes, encrypted } = encryptIdentityFile(plain);

    expect(encrypted).toBe(false);
    expect(decryptIdentityFile(bytes).equals(plain)).toBe(true);
  });

  it('refuses a tampered file', () => {
    process.env.IDENTITY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    const { bytes } = encryptIdentityFile(Buffer.from('a government ID'));
    bytes[bytes.length - 1] ^= 0xff;

    expect(() => decryptIdentityFile(bytes)).toThrow();
  });
});
