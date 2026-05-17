import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  POPOVER_WIDTH,
  computeHotspotPopoverPosition,
  type Point,
} from '../utils/hotspotPopoverPosition'

type HotspotPopoverProps = {
  anchor: Point
  platformAccent: string
  onMouseEnter: () => void
  onMouseLeave: () => void
  children: ReactNode
}

export function HotspotPopover({
  anchor,
  platformAccent,
  onMouseEnter,
  onMouseLeave,
  children,
}: HotspotPopoverProps) {
  const popRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(
    null,
  )

  const updatePlacement = useCallback(() => {
    const el = popRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const size = {
      width: rect.width > 0 ? rect.width : POPOVER_WIDTH,
      height: rect.height > 0 ? rect.height : 320,
    }
    setPlacement(
      computeHotspotPopoverPosition(anchor, size, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    )
  }, [anchor.x, anchor.y])

  useLayoutEffect(() => {
    updatePlacement()
    const el = popRef.current
    const ro =
      el && 'ResizeObserver' in window
        ? new ResizeObserver(() => updatePlacement())
        : null
    if (el) ro?.observe(el)
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [updatePlacement])

  return createPortal(
    <div
      ref={popRef}
      className="hotspot-popover hotspot-popover--fixed"
      role="tooltip"
      style={
        {
          left: placement?.left ?? -9999,
          top: placement?.top ?? -9999,
          visibility: placement ? 'visible' : 'hidden',
          '--platform-accent': platformAccent,
        } as CSSProperties
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  )
}
