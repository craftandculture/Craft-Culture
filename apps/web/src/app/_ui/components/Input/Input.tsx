import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, tv } from 'tailwind-variants';

import Icon, { type IconProp } from '../Icon/Icon';

export const inputStyles = tv({
  slots: {
    root: 'box-border flex shrink-0 items-center font-sans text-sm font-medium tracking-tight ring-2 ring-transparent transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:shadow-sm',
    input:
      'placeholder:text-text-muted/60 text-text-primary block max-w-full grow border-none bg-transparent text-sm focus:outline-none transition-colors duration-200',
  },
  variants: {
    variant: {
      outline: {
        root: '[&:not([data-state=disabled])]:hover:border-border-primary-hover border-border-primary bg-fill-primary focus-within:ring-border-primary border border-b-2',
      },
      ghost: null,
    },
    size: {
      sm: {
        root: 'min-h-8 rounded-md',
        input: 'min-h-[calc(2rem-2px)] px-2',
      },
      md: {
        root: 'min-h-9',
        input: 'min-h-[calc(2.25rem-2px)] px-2.5',
      },
      lg: {
        root: 'text-md min-h-10',
        input: 'min-h-[calc(2.5rem-2px)] px-3.5',
      },
    },
    shape: {
      rounded: {
        root: 'rounded-lg',
      },
      pill: {
        root: 'rounded-full',
      },
    },
    isDisabled: {
      true: {
        input: 'pointer-events-none cursor-not-allowed opacity-50',
      },
    },
    isTransparent: {
      true: {
        root: 'bg-transparent',
      },
    },
    hasIconLeft: {
      true: {
        root: 'pl-2.5',
      },
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'outline',
    isTransparent: false,
    shape: 'rounded',
  },
});

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'size'>,
    VariantProps<typeof inputStyles> {
  asChild?: boolean;
  iconLeft?: IconProp;
  iconRight?: IconProp;
  contentLeft?: React.ReactNode;
  contentRight?: React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

const { root, input } = inputStyles();

const Input = ({
  className,
  asChild,
  variant,
  size,
  iconLeft,
  iconRight,
  contentLeft,
  contentRight,
  isDisabled,
  isTransparent,
  shape,
  ref,
  ...props
}: InputProps) => {
  const Comp = asChild ? Slot : 'input';

  const hasIconLeft = !!iconLeft || !!contentLeft;

  return (
    <div
      data-state={isDisabled ? 'disabled' : 'enabled'}
      className={root({
        variant,
        size,
        isDisabled,
        isTransparent,
        shape,
        className,
        hasIconLeft,
        // hasIconRight
      })}
    >
      <span className="block">
        {iconLeft && <Icon icon={iconLeft} />}
        {contentLeft}
      </span>
      <Comp
        ref={ref}
        className={input({ size, isDisabled, hasIconLeft })}
        {...props}
        aria-disabled={isDisabled}
        disabled={isDisabled}
        size={20}
      />
      <span
      // className={iconRightStyles({
      //   size,
      //   hasIconRight: !!iconRight || !!contentRight
      // })}
      >
        {iconRight && <Icon icon={iconRight} />}
        {contentRight}
      </span>
    </div>
  );
};

export default Input;
