import { twMerge } from 'tailwind-merge';

export interface LogoProps {
  className?: string;
  height?: number;
}

const Logo = ({ className, height = 32 }: LogoProps) => {
  return (
    <div
      className={twMerge('font-semibold tracking-tight', className)}
      style={{ fontSize: `${height * 0.6}px` }}
    >
      Craft & Culture
    </div>
  );
};

export default Logo;
