import Logo from './Logo';
import PocketCellarLogo from './PocketCellarLogo';

export interface BrandedLogoProps {
  customerType: 'b2b' | 'b2c';
  className?: string;
  height?: number;
}

/**
 * Renders the appropriate logo based on customer type
 *
 * - B2C users see Pocket Cellar branding
 * - B2B users see Craft & Culture branding
 *
 * @param props - The branded logo props
 * @returns The appropriate logo component
 */
const BrandedLogo = ({
  customerType,
  className,
  height = 144,
}: BrandedLogoProps) => {
  if (customerType === 'b2c') {
    return <PocketCellarLogo className={className} height={height} />;
  }

  return <Logo className={className} height={height} />;
};

export default BrandedLogo;
