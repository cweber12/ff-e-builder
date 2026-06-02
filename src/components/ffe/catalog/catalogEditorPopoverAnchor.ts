export function resolveCatalogEditorPopoverAnchor(
  sidebarRect: DOMRect | undefined,
  tabsRect: DOMRect | undefined,
  viewportWidth: number,
) {
  if (!sidebarRect || !tabsRect) return null;

  const top = Math.round(tabsRect.bottom) + 1;
  const isDesktop = viewportWidth >= 1024;

  if (isDesktop) {
    return {
      top,
      right: Math.max(Math.round(viewportWidth - sidebarRect.left), 12),
    } as const;
  }

  return {
    top,
    left: Math.max(Math.round(sidebarRect.right) + 1, 12),
  } as const;
}
