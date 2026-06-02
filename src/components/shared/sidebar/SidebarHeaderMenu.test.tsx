import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MenuItem, MenuSub, MenuSubTrigger } from '../../primitives';
import { SidebarHeaderMenu } from './SidebarHeaderMenu';

function mockRect(
  element: Element,
  rect: Partial<DOMRect> & Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        x: rect.left,
        y: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        toJSON() {
          return this;
        },
      }) satisfies DOMRect,
  });
}

describe('SidebarHeaderMenu', () => {
  it('anchors the desktop menu from the trigger top-left and expands leftward', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    const user = userEvent.setup();

    render(
      <SidebarHeaderMenu>
        {({ closeMenu }) => <MenuItem onClick={closeMenu}>Edit</MenuItem>}
      </SidebarHeaderMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Sidebar options' });
    mockRect(trigger, { left: 100, right: 168, top: 24, bottom: 56 });

    await user.click(trigger);

    expect(screen.getByRole('menu')).toHaveStyle({
      position: 'fixed',
      top: '24px',
      right: '1180px',
    });
  });

  it('anchors desktop submenus from the submenu trigger top-left and expands leftward', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    const user = userEvent.setup();

    render(
      <SidebarHeaderMenu>
        {({
          closeMenu,
          submenuOpen,
          toggleSubmenu,
          submenuTriggerRef,
          submenuPanelRef,
          getSubmenuPosition,
        }) => (
          <>
            <MenuItem onClick={closeMenu}>Edit</MenuItem>
            <MenuSubTrigger
              ref={submenuTriggerRef}
              aria-expanded={submenuOpen}
              onClick={toggleSubmenu}
            >
              Download
            </MenuSubTrigger>
            <MenuSub
              open={submenuOpen}
              panelRef={submenuPanelRef}
              position={getSubmenuPosition({
                align: 'top',
                anchorEdge: 'left',
                panelEdge: 'right',
                offsetY: 0,
                offsetX: 0,
              })}
            >
              <MenuItem onClick={closeMenu}>PDF</MenuItem>
            </MenuSub>
          </>
        )}
      </SidebarHeaderMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Sidebar options' });
    mockRect(trigger, { left: 120, right: 188, top: 24, bottom: 56 });
    await user.click(trigger);

    const submenuTrigger = screen.getByRole('menuitem', { name: 'Download' });
    mockRect(submenuTrigger, { left: 92, right: 220, top: 40, bottom: 72 });
    await user.click(submenuTrigger);

    const menus = screen.getAllByRole('menu');
    expect(menus[1]).toHaveStyle({
      position: 'fixed',
      top: '40px',
      right: '1188px',
    });
  });
});
