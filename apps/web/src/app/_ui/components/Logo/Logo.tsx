import Image from 'next/image';

import logo from './logo.webp';

export interface LogoProps {
  className?: string;
  height?: number;
}

const Logo = ({ className, height = 32 }: LogoProps) => {
  return (
    <Image
      src={logo}
      alt="Craft & Culture"
      height={height}
      className={className}
      priority
    />
  );
};

export default Logo;
