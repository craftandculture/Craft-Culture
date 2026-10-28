/** A client record, as far as identity goes */
export interface ClientIdentityRecord {
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  cityDrinksVerifiedAt: Date | null;
}

/** Details as typed onto an order */
export interface TypedClientDetails {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

const normaliseEmail = (email: string | null | undefined) =>
  (email ?? '').trim().toLowerCase();

const normalisePhone = (phone: string | null | undefined) =>
  (phone ?? '').replace(/\D/g, '');

const normaliseName = (name: string | null | undefined) =>
  (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Whether typed details describe the same person a client record does
 *
 * A distributor verifies a person, not a name. So a record that has been
 * verified only matches details that agree with it: a typed phone or email must
 * be the one on the record (blank is fine, it adds nothing). An unverified
 * record matches on name alone, as before.
 *
 * @param record - The saved client
 * @param typed - The details typed onto the order
 * @returns True when the typed details can be treated as this client
 */
export const matchesClientIdentity = (
  record: ClientIdentityRecord,
  typed: TypedClientDetails,
) => {
  if (!record.cityDrinksVerifiedAt) return true;

  const typedPhone = normalisePhone(typed.phone);
  const typedEmail = normaliseEmail(typed.email);

  if (typedPhone && typedPhone !== normalisePhone(record.phone)) return false;
  if (typedEmail && typedEmail !== normaliseEmail(record.email)) return false;

  return true;
};

/**
 * Whether an edit changes who the client is (name, phone or email)
 *
 * The distributor's verification is of that person, so an edit that changes one
 * of these must be verified again.
 *
 * @param record - The client before the edit
 * @param edit - The fields being edited (`undefined` = not edited)
 * @returns True when the edit changes the client's identity
 */
export const changesClientIdentity = (
  record: Pick<ClientIdentityRecord, 'name' | 'email' | 'phone'>,
  edit: { name?: string; email?: string; phone?: string },
) =>
  (edit.name !== undefined &&
    normaliseName(edit.name) !== normaliseName(record.name)) ||
  (edit.email !== undefined &&
    normaliseEmail(edit.email) !== normaliseEmail(record.email)) ||
  (edit.phone !== undefined &&
    normalisePhone(edit.phone) !== normalisePhone(record.phone));

/**
 * The client details an order takes when it is linked to a saved client
 *
 * The record decides who the client is: its name, and its phone and email where
 * it has them. A typed phone or email is only kept where the record has none
 * and has not been verified. The delivery address may differ per order, so a
 * typed one is kept, falling back to the record's.
 *
 * @param record - The saved client
 * @param typed - The details typed onto the order
 * @returns The details to store on the order
 */
export const orderDetailsFromClient = (
  record: ClientIdentityRecord,
  typed: TypedClientDetails,
) => {
  const verified = !!record.cityDrinksVerifiedAt;
  const recordAddress = [
    record.addressLine1,
    record.addressLine2,
    record.city,
    record.stateProvince,
    record.postalCode,
    record.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');

  return {
    clientName: record.name,
    clientEmail: record.email || (verified ? null : typed.email || null),
    clientPhone: record.phone || (verified ? null : typed.phone || null),
    clientAddress: typed.address || recordAddress || null,
  };
};
