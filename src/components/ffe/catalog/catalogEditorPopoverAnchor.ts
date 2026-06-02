export function resolveCatalogEditorPopoverAnchor(
  railRect: DOMRect | undefined,
  headerRect: DOMRect | undefined,
) {
  if (!railRect || !headerRect) return null;

  const top = Math.round(headerRect.bottom) + 1;
  // Open flush to the right edge of the left tool rail, extending over the canvas.
  const left = Math.max(Math.round(railRect.right) + 1, 12);

  return { top, left } as const;
}
