import { tv, VariantProps } from 'tailwind-variants';

export const shimmerStyles = tv({
  base: 'animate-pulse rounded-md bg-gradient-to-r from-surface-muted via-surface-muted-hover to-surface-muted bg-[length:200%_100%]',
  variants: {
    variant: {
      text: 'h-4',
      price: 'h-5',
    },
    width: {
      default: 'w-20',
      wide: 'w-24',
    },
  },
  defaultVariants: {
    variant: 'text',
    width: 'default',
  },
});

export interface ShimmerProps extends VariantProps<typeof shimmerStyles> {
  className?: string;
}

const Shimmer = ({ variant, width, className }: ShimmerProps) => {
  return (
    <div
      className={shimmerStyles({ variant, width, className })}
      style={{
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    >
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Shimmer;
