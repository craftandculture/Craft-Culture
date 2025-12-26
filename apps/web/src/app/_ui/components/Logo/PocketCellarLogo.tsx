import Image from 'next/image';

import logo from './pocket-cellar-logo.png';

export interface PocketCellarLogoProps {
  className?: string;
  height?: number;
}

/**
 * Logo component for B2C Pocket Cellar branding
 *
 * @param props - The logo props
 * @returns The Pocket Cellar logo image
 */
const PocketCellarLogo = ({ className, height = 36 }: PocketCellarLogoProps) => {
  return (
    <Image
      src={logo}
      alt="Pocket Cellar"
      height={height}
      className={`${className} dark:invert`}
      priority
    />
  );
};

export default PocketCellarLogo;
