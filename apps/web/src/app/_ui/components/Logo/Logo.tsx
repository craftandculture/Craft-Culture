import Image, { ImageProps } from 'next/image';
import { twMerge } from 'tailwind-merge';

import LogoImage from './logo.webp';

export interface LogoProps extends Omit<ImageProps, 'src' | 'alt'> {}

const Logo = ({ className, ...props }: LogoProps) => {
  return (
    <Image
      src={LogoImage}
      alt="Logo"
      className={twMerge(
        'transition-[filter] dark:invert dark:brightness-0 dark:contrast-100',
        className,
      )}
      {...props}
    />
  );
};

export default Logo;
