import normalizeUrl from '@/utils/normalizeUrl';

const getWebsiteFromUserEmail = (email: string) => {
  const domain = email.split('@')[1];

  if (!domain) {
    throw new Error(`Invalid email format: ${email}`);
  }

  return normalizeUrl(domain);
};

export default getWebsiteFromUserEmail;
