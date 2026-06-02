import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';

type AnchorAlign = 'top' | 'bottom';
type AnchorEdge = 'left' | 'right';
type PanelEdge = 'left' | 'right';

type PortalPositionOptions = {
  align?: AnchorAlign;
  anchorEdge?: AnchorEdge;
  panelEdge?: PanelEdge;
  edge?: AnchorEdge;
  offsetY?: number;
  offsetX?: number;
};

const defaultPortalPositionOptions: Required<PortalPositionOptions> = {
  align: 'bottom',
  anchorEdge: 'right',
  panelEdge: 'right',
  edge: 'right',
  offsetY: 4,
  offsetX: 0,
};

function inAnyRef(target: Node, refs: Array<HTMLElement | null>) {
  return refs.some((element) => element?.contains(target) ?? false);
}

export function useActionsMenu() {
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const submenuTriggerRef = useRef<HTMLButtonElement>(null);
  const submenuPanelRef = useRef<HTMLDivElement>(null);

  const closeSubmenu = useCallback(() => {
    setSubmenuOpen(false);
  }, []);

  const openSubmenu = useCallback(() => {
    setSubmenuOpen(true);
  }, []);

  const toggleSubmenu = useCallback(() => {
    setSubmenuOpen((current) => !current);
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSubmenuOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen((current) => !current);
    setSubmenuOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        inAnyRef(target, [
          triggerRef.current,
          panelRef.current,
          submenuTriggerRef.current,
          submenuPanelRef.current,
        ])
      ) {
        return;
      }
      // Portaled submenu flyouts live outside the panel refs; honor their opt-out.
      const element = target instanceof Element ? target : target.parentElement;
      if (element?.closest('[data-actions-menu-safe]')) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeMenu();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeMenu]);

  const getPortalPosition = useCallback(
    <TElement extends HTMLElement>(
      anchorRef: RefObject<TElement | null>,
      options: PortalPositionOptions = {},
    ): CSSProperties | null => {
      const anchor = anchorRef.current;
      if (!anchor) return null;
      const rect = anchor.getBoundingClientRect();
      const resolved = { ...defaultPortalPositionOptions, ...options };
      const anchorEdge = options.anchorEdge ?? options.edge ?? resolved.anchorEdge;
      const panelEdge = options.panelEdge ?? options.edge ?? resolved.panelEdge;

      const style: CSSProperties = {
        position: 'fixed',
      };

      style.top =
        resolved.align === 'bottom' ? rect.bottom + resolved.offsetY : rect.top + resolved.offsetY;

      const anchorX = anchorEdge === 'right' ? rect.right : rect.left;

      if (panelEdge === 'right') {
        style.right = window.innerWidth - anchorX + resolved.offsetX;
      } else {
        style.left = anchorX + resolved.offsetX;
      }

      return style;
    },
    [],
  );

  return {
    open,
    submenuOpen,
    triggerRef,
    panelRef,
    submenuTriggerRef,
    submenuPanelRef,
    openMenu,
    closeMenu,
    toggleMenu,
    openSubmenu,
    closeSubmenu,
    toggleSubmenu,
    getPortalPosition,
  };
}
