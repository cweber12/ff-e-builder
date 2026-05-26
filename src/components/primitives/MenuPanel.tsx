import { createPortal } from 'react-dom';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '../../lib/utils';

type MenuPanelProps = HTMLAttributes<HTMLDivElement> & {
  position?: CSSProperties | null;
};

export const MenuPanel = forwardRef<HTMLDivElement, MenuPanelProps>(function MenuPanel(
  { className, position, style, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="menu"
      style={{ ...(position ?? {}), ...(style ?? {}) }}
      className={cn('menu-panel animate-in fade-in-0 zoom-in-95 duration-100', className)}
      {...props}
    >
      {children}
    </div>
  );
});

type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function MenuItem({ className, type = 'button', ...props }: MenuItemProps) {
  return <button type={type} role="menuitem" className={cn('menu-item', className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('my-1 h-px bg-neutral-100', className)} {...props} />;
}

type MenuSubTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const MenuSubTrigger = forwardRef<HTMLButtonElement, MenuSubTriggerProps>(
  function MenuSubTrigger({ className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        role="menuitem"
        aria-haspopup="menu"
        className={cn('menu-item', className)}
        {...props}
      />
    );
  },
);

type MenuSubProps = {
  open: boolean;
  position: CSSProperties | null;
  panelRef?: RefObject<HTMLDivElement>;
  className?: string;
  children: ReactNode;
};

export function MenuSub({ open, position, panelRef, className, children }: MenuSubProps) {
  if (!open || !position) return null;
  return createPortal(
    <MenuPanel ref={panelRef} position={position} className={className}>
      {children}
    </MenuPanel>,
    document.body,
  );
}
