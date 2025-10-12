import Image, { ImageProps } from 'next/image';

import LogoImage from './logo.webp';

export interface LogoProps extends Omit<ImageProps, 'src' | 'alt'> {}

const Logo = ({ className, ...props }: LogoProps) => {
  return (
    <Image
      src={LogoImage}
      alt="Logo"
      className={`dark:invert ${className || ''}`}
      {...props}
    />
  );
};

export default Logo;
