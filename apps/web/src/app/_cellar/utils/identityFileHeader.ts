/**
 * The bytes every encrypted identity file starts with
 *
 * Followed by a 12-byte IV, a 16-byte GCM tag, then the ciphertext. A file
 * without it was stored before encryption existed and is read as it is.
 */
const identityFileHeader = Buffer.from('CCID1');

export default identityFileHeader;
