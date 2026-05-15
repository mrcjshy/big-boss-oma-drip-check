import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import { mapBboxToDisplayedRect } from '../../shared/bbox'
import { PLATFORM_ACCENTS, PLATFORM_LABELS } from '../constants'
import type { ClothingItem } from '../types'

const MAX_DOTS = 8
const POPOVER_WIDTH = 232
const POPOVER_GAP = 14
const POPOVER_HEIGHT_ESTIMATE = 268
const HOVER_LEAVE_DELAY_MS = 160

type DotLayout = {
  item: ClothingItem
  bboxLeft: number
  bboxTop: number
  bboxWidth: number
  bboxHeight: number
  bboxCenterX: number
  bboxCenterY: number
  popoverLeft: number
  popoverTop: number
  popoverWidth: number
  popoverHeight: number
  popoverPlacement: 'right' | 'left'
  cheapestPrice: number
}

type ImageMetrics = {
  displayWidth: number
  displayHeight: number
  naturalWidth: number
  naturalHeight: number
}

const cheapestPriceFor = (item: ClothingItem): number => {
  const prices = item.platforms
    .map((deal) => deal.estimatedPricePhp)
    .filter((value) => Number.isFinite(value) && value > 0)
  if (prices.length === 0) return 0
  return Math.min(...prices)
}

const computeLayout = (
  items: ClothingItem[],
  metrics: ImageMetrics,
): DotLayout[] => {
  const { displayWidth, displayHeight, naturalWidth, naturalHeight } = metrics

  return items.flatMap((item) => {
    const rect = mapBboxToDisplayedRect(
      item.bbox,
      naturalWidth,
      naturalHeight,
      displayWidth,
      displayHeight,
      'cover',
    )
    if (!rect) return []

    const popoverWidth = Math.min(POPOVER_WIDTH, Math.max(180, displayWidth - 24))
    const popoverHeight = POPOVER_HEIGHT_ESTIMATE

    const spaceRight = displayWidth - rect.centerX
    const placement: 'right' | 'left' =
      spaceRight >= popoverWidth + POPOVER_GAP + 8 ? 'right' : 'left'

    let popoverLeft =
      placement === 'right'
        ? rect.centerX + POPOVER_GAP
        : rect.centerX - POPOVER_GAP - popoverWidth
    let popoverTop = rect.centerY - popoverHeight / 2

    popoverLeft = Math.max(8, Math.min(displayWidth - popoverWidth - 8, popoverLeft))
    popoverTop = Math.max(8, Math.min(displayHeight - popoverHeight - 8, popoverTop))

    return [
      {
        item,
        bboxLeft: rect.left,
        bboxTop: rect.top,
        bboxWidth: rect.width,
        bboxHeight: rect.height,
        bboxCenterX: rect.centerX,
        bboxCenterY: rect.centerY,
        popoverLeft,
        popoverTop,
        popoverWidth,
        popoverHeight,
        popoverPlacement: placement,
        cheapestPrice: cheapestPriceFor(item),
      },
    ]
  })
}

type HotspotProps = {
  layout: DotLayout
  active: boolean
  onActivate: () => void
  onHoverEnter: () => void
  onHoverLeave: () => void
}

function Hotspot({ layout, active, onActivate, onHoverEnter, onHoverLeave }: HotspotProps) {
  const style: CSSProperties = {
    left: `${layout.bboxCenterX}px`,
    top: `${layout.bboxCenterY}px`,
  }

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate()
    }
  }

  return (
    <button
      type="button"
      className={`hotspot ${active ? 'hotspot--active' : ''}`}
      style={style}
      aria-label={`${layout.item.itemName}, from ₱${layout.cheapestPrice.toLocaleString('en-PH')}. Show shop links.`}
      aria-expanded={active}
      onClick={(event) => {
        event.stopPropagation()
        onActivate()
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onFocus={onHoverEnter}
      onBlur={onHoverLeave}
      onKeyDown={handleKey}
    >
      <span className="hotspot__pulse" aria-hidden="true" />
      <span className="hotspot__pulse hotspot__pulse--delay" aria-hidden="true" />
      <span className="hotspot__dot" aria-hidden="true" />
    </button>
  )
}

type PopoverProps = {
  layout: DotLayout
  pinned: boolean
  onClose: () => void
  onHoverEnter: () => void
  onHoverLeave: () => void
}

function HotspotPopover({
  layout,
  pinned,
  onClose,
  onHoverEnter,
  onHoverLeave,
}: PopoverProps) {
  const { item, popoverLeft, popoverTop, popoverWidth, popoverPlacement, cheapestPrice } =
    layout

  const style: CSSProperties = {
    left: `${popoverLeft}px`,
    top: `${popoverTop}px`,
    width: `${popoverWidth}px`,
  }

  return (
    <div
      className={`hotspot-popover hotspot-popover--${popoverPlacement} ${
        pinned ? 'hotspot-popover--pinned' : ''
      }`}
      style={style}
      role="dialog"
      aria-label={`${item.itemName} shopping options`}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="hotspot-popover__head">
        <span className="hotspot-popover__category">{item.category}</span>
        <button
          type="button"
          className="hotspot-popover__close"
          aria-label="Close shop links"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          ×
        </button>
      </div>
      <h4 className="hotspot-popover__name">{item.itemName}</h4>
      <p className="hotspot-popover__meta">
        {item.color} · {item.style}
      </p>
      <div className="hotspot-popover__from">
        <span className="hotspot-popover__from-label">From</span>
        <span className="hotspot-popover__from-price">
          ₱{cheapestPrice.toLocaleString('en-PH')}
        </span>
      </div>
      <ul className="hotspot-popover__shops">
        {item.platforms.map((deal) => {
          const isBest = deal.platform === item.bestPlatform
          return (
            <li key={deal.platform}>
              <a
                className={`hotspot-shop ${isBest ? 'hotspot-shop--best' : ''}`}
                href={deal.url}
                target="_blank"
                rel="noreferrer"
                style={
                  {
                    '--shop-accent': PLATFORM_ACCENTS[deal.platform],
                  } as CSSProperties
                }
                aria-label={`Open ${PLATFORM_LABELS[deal.platform]} for ${item.itemName}, estimated ₱${deal.estimatedPricePhp.toLocaleString('en-PH')}`}
              >
                <span
                  className="hotspot-shop__swatch"
                  aria-hidden="true"
                />
                <span className="hotspot-shop__name">
                  {PLATFORM_LABELS[deal.platform]}
                  {isBest && <span className="hotspot-shop__best">Best</span>}
                </span>
                <span className="hotspot-shop__price">
                  ₱{deal.estimatedPricePhp.toLocaleString('en-PH')}
                </span>
                <span className="hotspot-shop__arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type BboxOverlayProps = {
  items: ClothingItem[]
  imgRef: RefObject<HTMLImageElement | null>
  visible: boolean
}

const DEBUG_QUERY_KEY = 'debugBbox'

const isDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false
  const value = new URLSearchParams(window.location.search).get(DEBUG_QUERY_KEY)
  return value === '1' || value === 'true'
}

function BboxOverlay({ items, imgRef, visible }: BboxOverlayProps) {
  const [metrics, setMetrics] = useState<ImageMetrics>({
    displayWidth: 0,
    displayHeight: 0,
    naturalWidth: 0,
    naturalHeight: 0,
  })
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debug = useMemo(() => isDebugEnabled(), [])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    const update = () => {
      const rect = img.getBoundingClientRect()
      setMetrics({
        displayWidth: rect.width,
        displayHeight: rect.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })
    }
    update()

    const observer = new ResizeObserver(update)
    observer.observe(img)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    img.addEventListener('load', update)

    let cancelled = false
    const fontsApi = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
    if (fontsApi?.ready) {
      void fontsApi.ready.then(() => {
        if (!cancelled) update()
      })
    }

    return () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      img.removeEventListener('load', update)
    }
  }, [imgRef])

  useEffect(() => {
    if (!pinnedId) return

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('.hotspot') || target.closest('.hotspot-popover')) return
      setPinnedId(null)
    }

    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinnedId(null)
        setHoveredId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [pinnedId])

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const layouts = useMemo(() => {
    if (!visible) return []
    if (!metrics.displayWidth || !metrics.displayHeight) return []
    if (!metrics.naturalWidth || !metrics.naturalHeight) return []

    const top = [...items]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_DOTS)

    return computeLayout(top, metrics)
  }, [items, metrics, visible])

  if (!visible) return null
  if (metrics.displayWidth === 0 || metrics.displayHeight === 0) return null
  if (metrics.naturalWidth === 0 || metrics.naturalHeight === 0) return null
  if (layouts.length === 0) return null

  const cancelHoverLeave = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  const scheduleHoverLeave = () => {
    cancelHoverLeave()
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredId(null)
    }, HOVER_LEAVE_DELAY_MS)
  }

  const onHotspotEnter = (id: string) => {
    cancelHoverLeave()
    setHoveredId(id)
  }

  const onActivate = (id: string) => {
    setPinnedId((current) => (current === id ? null : id))
    setHoveredId(null)
    cancelHoverLeave()
  }

  const activeId = pinnedId ?? hoveredId
  const activeLayout = layouts.find((l) => l.item.id === activeId)

  return (
    <div ref={overlayRef} className="bbox-overlay" aria-hidden="false">
      {debug &&
        layouts.map((layout) => (
          <div
            key={`debug-${layout.item.id}`}
            className="bbox-overlay__debug-rect"
            style={{
              left: `${layout.bboxLeft}px`,
              top: `${layout.bboxTop}px`,
              width: `${layout.bboxWidth}px`,
              height: `${layout.bboxHeight}px`,
            }}
            aria-hidden="true"
          />
        ))}

      {activeLayout && (
        <svg
          className="bbox-overlay__leader"
          width={metrics.displayWidth}
          height={metrics.displayHeight}
          aria-hidden="true"
        >
          <line
            x1={activeLayout.bboxCenterX}
            y1={activeLayout.bboxCenterY}
            x2={
              activeLayout.popoverPlacement === 'right'
                ? activeLayout.popoverLeft
                : activeLayout.popoverLeft + activeLayout.popoverWidth
            }
            y2={activeLayout.popoverTop + 22}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
        </svg>
      )}

      {layouts.map((layout) => (
        <Hotspot
          key={layout.item.id}
          layout={layout}
          active={activeId === layout.item.id}
          onActivate={() => onActivate(layout.item.id)}
          onHoverEnter={() => onHotspotEnter(layout.item.id)}
          onHoverLeave={scheduleHoverLeave}
        />
      ))}

      {activeLayout && (
        <HotspotPopover
          layout={activeLayout}
          pinned={pinnedId === activeLayout.item.id}
          onClose={() => {
            setPinnedId(null)
            setHoveredId(null)
            cancelHoverLeave()
          }}
          onHoverEnter={cancelHoverLeave}
          onHoverLeave={scheduleHoverLeave}
        />
      )}
    </div>
  )
}

export default BboxOverlay
