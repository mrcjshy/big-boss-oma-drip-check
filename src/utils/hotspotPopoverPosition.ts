export const POPOVER_WIDTH = 220
export const POPOVER_OFFSET = 14
export const VIEWPORT_PADDING = 12

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Viewport = { width: number; height: number }
export type Placement = { left: number; top: number }

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Viewport-fixed placement so the popover stays on-screen and clear of the anchor. */
export function computeHotspotPopoverPosition(
  anchor: Point,
  popover: Size,
  viewport: Viewport,
  padding = VIEWPORT_PADDING,
): Placement {
  const maxLeft = Math.max(padding, viewport.width - popover.width - padding)
  const maxTop = Math.max(padding, viewport.height - popover.height - padding)

  let left =
    anchor.x + POPOVER_OFFSET <= maxLeft
      ? anchor.x + POPOVER_OFFSET
      : anchor.x - popover.width - POPOVER_OFFSET

  left = clamp(left, padding, maxLeft)
  const top = clamp(anchor.y - popover.height / 2, padding, maxTop)

  return { left, top }
}
