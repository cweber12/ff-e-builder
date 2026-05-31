import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
  type Ref,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../../lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'toolbar'
  | 'toolbarPrimary'
  | 'addAction';

const variantClasses: Record<ButtonVariant, string> = {
  // Filled actions use the slightly lighter brand-500 (was brand-600) so primary
  // buttons read a touch brighter against the warm parchment surfaces.
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-600',
  // Secondary: light neutral surface with a dark-blue border on hover —
  // hover:bg-brand-50 now resolves to warm sand (see index.css token notes).
  secondary:
    'bg-white border border-neutral-200 text-neutral-800 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-50',
  ghost:
    'bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-brand-700 active:bg-neutral-100',
  danger: 'bg-danger-500 text-white shadow-sm hover:bg-danger-600 active:bg-danger-600',
  // Header toolbar buttons: borderless, background-free, with an animated brand
  // underline (.btn-toolbar in index.css). `font-semibold` is kept as a utility
  // so it wins over the base `font-medium`.
  toolbar: 'btn-toolbar font-semibold',
  toolbarPrimary: 'btn-toolbar btn-toolbar--primary font-semibold',
  // Dedicated Add actions: themed light fill, no border, and motion-rich affordance.
  addAction: 'btn-add-action font-semibold',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

const sizeClasses = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    asChild = false,
    className,
    children,
    disabled,
    onClick,
    ...props
  }: ButtonProps,
  ref,
) {
  const isToolbarVariant =
    variant === 'toolbar' || variant === 'toolbarPrimary' || variant === 'addAction';
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-sm font-medium',
    'transition duration-150 active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    isToolbarVariant ? 'h-8 px-3' : sizeClasses[size],
    className,
  );

  if (asChild) {
    if (!isValidElement(children)) return null;
    const child = children as ReactElement<{
      className?: string;
      onClick?: MouseEventHandler<HTMLElement>;
      tabIndex?: number;
      'aria-disabled'?: boolean;
      ref?: Ref<HTMLElement>;
    }>;
    const childOnClick = child.props.onClick;

    return cloneElement(child, {
      className: cn(classes, disabled && 'pointer-events-none opacity-50', child.props.className),
      onClick: (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
        childOnClick?.(event);
      },
      ...(disabled
        ? { tabIndex: -1 }
        : child.props.tabIndex !== undefined
          ? { tabIndex: child.props.tabIndex }
          : {}),
      ...(disabled ? { 'aria-disabled': true as const } : {}),
    });
  }

  return (
    <button ref={ref} {...props} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
});

type ButtonLinkProps = Omit<ButtonProps, 'asChild' | 'children' | 'type' | 'onClick'> &
  LinkProps & {
    children: ReactNode;
  };

export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  to,
  ...linkProps
}: ButtonLinkProps) {
  return (
    <Button asChild variant={variant} size={size} className={className} disabled={disabled}>
      <Link to={to} {...linkProps}>
        {children}
      </Link>
    </Button>
  );
}
