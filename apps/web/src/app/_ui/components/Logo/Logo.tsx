import Image from 'next/image';

import logo from './logo.png';

export interface LogoProps {
  className?: string;
  height?: number;
}

const Logo = ({ className, height = 144 }: LogoProps) => {
  return (
    <Image
      src={logo}
      alt="Craft & Culture Index"
      height={height}
      className={`${className} dark:invert`}
      priority
    />
  );
};

export default Logo;
