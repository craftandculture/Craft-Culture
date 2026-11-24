import { describe, expect, it } from 'vitest';

import movementCursor from './movementCursor';

describe('movementCursor', () => {
  const id = '0b7c1f9e-3a52-4f7d-9a1e-2c4b5d6e7f80';

  it('round-trips to the microsecond', () => {
    const at = '2026-11-24 09:15:02.123456';
    expect(movementCursor.decode(movementCursor.encode(at, id))).toEqual({ at, id });
  });

  it('refuses anything it did not issue', () => {
    expect(movementCursor.decode('junk')).toBeNull();
    expect(movementCursor.decode(Buffer.from(`2026-11-24|${id}`).toString('base64url'))).toBeNull();
    expect(movementCursor.decode(Buffer.from("2026-11-24 09:15:02|1; drop table").toString('base64url'))).toBeNull();
  });
});
