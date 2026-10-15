/**
 * Compare two strings in constant time, without Node's crypto
 *
 * For code on the edge runtime (middleware), where `crypto.timingSafeEqual`
 * is unavailable. Every character of the longer string is visited whatever
 * the inputs, so the time taken does not reveal how much of a guess was
 * right. Only the length can leak, which for a random token reveals nothing
 * useful.
 *
 * @example
 *   constantTimeEqual(presented, process.env.WMS_DEVICE_TOKEN ?? ''); // boolean
 *
 * @param a - The presented value
 * @param b - The expected value
 * @returns True when the strings are identical
 */
const constantTimeEqual = (a: string, b: string) => {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
};

export default constantTimeEqual;
