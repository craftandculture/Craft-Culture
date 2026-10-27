/**
 * Raised instead of calling Wine Labs once the month's credit cap is reached,
 * so the caller can say so rather than skip silently
 */
class WinelabsCapError extends Error {
  constructor(spent: number, cap: number) {
    super(`Wine Labs credit cap reached: ${spent} of ${cap} credits used this month`);
    this.name = 'WinelabsCapError';
  }
}

export default WinelabsCapError;
