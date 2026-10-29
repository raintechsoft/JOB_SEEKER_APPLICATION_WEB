type Viewport = { width: number; height: number; left?: number; top?: number };
type Anchor = { left: number; bottom: number };

/** Keep a filter popup within the visible viewport, including when the mobile keyboard opens. */
export function filterPopoverPosition(anchor: Anchor, menuHeight: number, viewport: Viewport) {
  const margin = 16, left = viewport.left ?? 0, top = viewport.top ?? 0;
  const width = Math.max(0, Math.min(340, viewport.width - margin * 2));
  const maxHeight = Math.max(0, viewport.height - margin * 2);
  const height = Math.min(menuHeight, maxHeight);
  return {
    left: Math.max(left + margin, Math.min(anchor.left, left + viewport.width - width - margin)),
    top: Math.max(top + margin, Math.min(anchor.bottom + 8, top + viewport.height - height - margin)),
    width,
    maxHeight,
  };
}
