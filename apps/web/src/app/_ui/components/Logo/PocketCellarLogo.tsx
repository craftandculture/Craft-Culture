import { IconGlassFull } from '@tabler/icons-react';

export interface PocketCellarLogoProps {
  className?: string;
  height?: number;
}

/**
 * Logo component for B2C Pocket Cellar branding
 *
 * @param props - The logo props
 * @returns The Pocket Cellar logo
 */
const PocketCellarLogo = ({ className, height = 144 }: PocketCellarLogoProps) => {
  // Scale text size based on height (144 is default, maps to text-xl)
  const scale = height / 144;
  const iconSize = Math.round(20 * scale);

  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      style={{ height: height * 0.25 }}
    >
      <IconGlassFull
        size={iconSize}
        className="text-fill-brand shrink-0"
        stroke={1.5}
      />
      <span
        className="text-text-primary whitespace-nowrap font-semibold tracking-tight"
        style={{ fontSize: `${0.875 * scale}rem` }}
      >
        Pocket Cellar
      </span>
    </div>
  );
};

export default PocketCellarLogo;
