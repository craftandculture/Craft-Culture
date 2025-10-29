import Image from 'next/image';

import logo from './logo.png';

export interface LogoProps {
  className?: string;
  height?: number;
}

const Logo = ({ className, height = 96 }: LogoProps) => {
  return (
    <Image
      src={logo}
      alt="Craft & Culture Index"
      height={height}
      className={className}
      priority
    />
  );
};

export default Logo;
