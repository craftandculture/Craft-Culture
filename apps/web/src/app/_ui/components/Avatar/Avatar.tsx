import Image from 'next/image';
import { useState } from 'react';
import { VariantProps, tv } from 'tailwind-variants';

import EmtptyAvatar from '@/public/empty-avatar.png';

import randomColor from '../../utils/randomColor';
import Typography from '../Typography/Typography';
export const avatarStyles = tv({
  base: 'flex items-center justify-center overflow-hidden',
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-6',
      lg: 'size-7',
      xl: 'size-9',
    },
    shape: {
      rect: 'rounded-md',
      circle: 'rounded-full',
    },
    isLoaded: {
      false: 'bg-surface-muted',
    },
  },
  compoundVariants: [
    {
      shape: 'rect',
      size: 'sm',
      className: 'rounded',
    },
  ],
  defaultVariants: {
    size: 'md',
    shape: 'rect',
  },
});

export interface AvatarProps extends VariantProps<typeof avatarStyles> {
  className?: string;
  domain?: string;
  src?: string | null;
  fallback?: string;
  fallbackType?: 'letter' | 'image';
  fallbackSeed?: string | number;
}

const Avatar = ({
  src: _src,
  domain,
  fallback,
  fallbackSeed,
  fallbackType = 'letter',
  ...props
}: AvatarProps) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const firstLetter = fallback?.charAt(0).toUpperCase();

  const seed = fallbackSeed ? fallbackSeed.toString() : fallback;

  const { hue, saturation, lightness } = randomColor(seed ?? 'default');

  const gradientFrom = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const gradientTo = `hsl(${hue}, ${saturation}%, ${lightness - 10}%)`;

  const src = _src ?? domain;

  const hasImage = src && !hasError;

  return (
    <span
      className={avatarStyles({ ...props, isLoaded })}
      style={
        !hasImage
          ? {
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
              color: `hsl(${hue}, ${saturation}%, 25%)`,
            }
          : undefined
      }
    >
      {hasImage ? (
        <Image
          src={src}
          alt={fallback ?? 'Avatar'}
          width={64}
          height={64}
          loader={({ src, width, quality }) => {
            return _src
              ? _src
              : `/api/favicon/${src}?w=${width}&q=${quality || 75}`;
          }}
          onLoad={() => {
            setIsLoaded(true);
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
          }}
        />
      ) : fallbackType === 'image' ? (
        <Image src={EmtptyAvatar} alt={fallback ?? 'Avatar'} />
      ) : (
        <Typography variant="bodyXs" className="text-[9px]" asChild>
          <span className="block">{firstLetter}</span>
        </Typography>
      )}
    </span>
  );
};

export default Avatar;
