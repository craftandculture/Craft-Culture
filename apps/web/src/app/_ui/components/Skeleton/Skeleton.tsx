import { VariantProps, tv } from 'tailwind-variants';

const skeletonStyles = tv({
  base: 'bg-linear-to-tr from-fill-muted/50 to-fill-muted/25 animate-pulse rounded-lg brightness-90',
});

export interface SkeletonProps
  extends VariantProps<typeof skeletonStyles>,
    React.HTMLAttributes<HTMLDivElement> {
  width?: number;
  height?: number;
}

const Skeleton = ({
  className,
  width,
  height,
  style,
  ...props
}: SkeletonProps) => {
  return (
    <div
      {...props}
      className={skeletonStyles({ className })}
      style={{
        ...style,
        minWidth: width ? `${width}px` : undefined,
        minHeight: height ? `${height}px` : undefined,
      }}
    />
  );
};

export default Skeleton;
