'use client';

import Link, { LinkProps } from 'next/link';
import { useMemo } from 'react';

import useSearchParams from '../../hooks/useSearchParams';

type NextLinkFullPRops = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  keyof LinkProps & {
    asChild?: boolean;
  }
> &
  LinkProps;

export interface SearchAwareLinkProps extends NextLinkFullPRops {
  preserveSearch?: boolean;
  href: string | URL;
  isExternal?: boolean;
}

const SearchAwareLink = ({
  preserveSearch,
  href,
  isExternal = false,
  rel,
  target,
  ...props
}: SearchAwareLinkProps) => {
  const searchParams = useSearchParams();

  const hrefWithSearch = useMemo(() => {
    if (searchParams && preserveSearch) {
      return `${href}?${searchParams.toString()}`;
    }

    return href;
  }, [href, searchParams, preserveSearch]);

  return (
    <Link
      {...props}
      href={hrefWithSearch}
      rel={isExternal ? 'noopener noreferrer' : rel}
      target={isExternal ? '_blank' : target}
    />
  );
};

export default SearchAwareLink;
