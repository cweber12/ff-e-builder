import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
  type Ref,
} from 'react';
import { cn } from '../../../lib/utils';

type SidebarButtonVariant = 'default' | 'add';

type SidebarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  selected?: boolean;
  variant?: SidebarButtonVariant;
};

export const SidebarButton = forwardRef<HTMLButtonElement, SidebarButtonProps>(
  function SidebarButton(
    {
      asChild = false,
      selected = false,
      variant = 'default',
      className,
      disabled,
      onClick,
      children,
      ...props
    },
    ref,
  ) {
    const classes = cn(
      'sidebar-button',
      variant === 'add' && 'sidebar-button--add',
      selected && 'sidebar-button--selected',
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
  },
);
