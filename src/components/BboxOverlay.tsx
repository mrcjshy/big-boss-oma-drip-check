import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import { PLATFORM_ACCENTS, PLATFORM_LABELS } from '../constants'
import type { ClothingItem, PlatformId } from '../types'

type BboxOverlayProps = {
  imageRef: RefObject<HTMLImageElement | null>
  items: ClothingItem[]
}

type ImageBox = {
  left: number
  top: number
  width: number
  height: number
}

const POPOVER_WIDTH = 220
const POPOVER_HEIGHT_EST = 310
const POPOVER_OFFSET = 14
const MAX_VISIBLE = 8

const PLATFORM_GLOW: Record<string, string> = {
  shopee: 'rgba(238, 119, 11, 0.65)',
  lazada: 'rgba(0, 109, 237, 0.65)',
  carousell: 'rgba(76, 175, 80, 0.65)',
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function BboxOverlay({ imageRef, items }: BboxOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [imageBox, setImageBox] = useState<ImageBox | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [tabOverrides, setTabOverrides] = useState<Record<string, PlatformId>>({})
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeTabByItem = useMemo<Record<string, PlatformId>>(() => {
    const defaults: Record<string, PlatformId> = {}
    items.forEach((item) => {
      defaults[item.id] = item.bestPlatform
    })
    return { ...defaults, ...tabOverrides }
  }, [items, tabOverrides])

  useEffect(() => {
    const image = imageRef.current
    const overlay = overlayRef.current
    if (!image || !overlay) return

    let frameId = 0
    const update = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const imageRect = image.getBoundingClientRect()
        const overlayRect = overlay.getBoundingClientRect()
        setImageBox({
          left: imageRect.left - overlayRect.left,
          top: imageRect.top - overlayRect.top,
          width: imageRect.width,
          height: imageRect.height,
        })
      })
    }

    update()
    image.addEventListener('load', update)
    window.addEventListener('resize', update)
    const ro = 'ResizeObserver' in window ? new ResizeObserver(update) : null
    ro?.observe(image)

    return () => {
      cancelAnimationFrame(frameId)
      image.removeEventListener('load', update)
      window.removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [imageRef, items])

  useEffect(() => {
    const collapse = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('.hotspot-group')) {
        setPinnedId(null)
      }
    }
    document.addEventListener('pointerdown', collapse, true)
    return () => document.removeEventListener('pointerdown', collapse, true)
  }, [])

  const visibleItems = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, MAX_VISIBLE),
    [items],
  )

  const clearHover = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    hoverTimeout.current = setTimeout(() => setHoveredId(null), 200)
  }, [])

  const keepHover = useCallback((id: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setHoveredId(id)
  }, [])

  const togglePin = useCallback((id: string) => {
    setPinnedId((cur) => (cur === id ? null : id))
  }, [])

  const handleHotspotKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      togglePin(id)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setPinnedId(null)
      setHoveredId(null)
    }
  }

  if (!imageBox) return <div ref={overlayRef} className="bbox-overlay" />

  return (
    <div ref={overlayRef} className="bbox-overlay" aria-label="Detected clothing items">
      {visibleItems.map((item) => {
        const [ymin, xmin, ymax, xmax] = item.bbox
        const cx = imageBox.left + ((xmin + xmax) / 2000) * imageBox.width
        const cy = imageBox.top + ((ymin + ymax) / 2000) * imageBox.height
        const isBest = item.platforms.some((p) => p.platform === item.bestPlatform)
        const glowColor =
          isBest
            ? (PLATFORM_GLOW[item.bestPlatform] ?? 'rgba(255,77,46,0.65)')
            : 'rgba(255,255,255,0.55)'
        const isOpen = hoveredId === item.id || pinnedId === item.id
        const activeTab = activeTabByItem[item.id] ?? item.bestPlatform
        const activeDeal =
          item.platforms.find((p) => p.platform === activeTab) ?? item.platforms[0]

        const imageRight = imageBox.left + imageBox.width
        const imageBottom = imageBox.top + imageBox.height
        let popX = cx + POPOVER_OFFSET
        let popY = cy - POPOVER_HEIGHT_EST / 2
        if (popX + POPOVER_WIDTH > imageRight) {
          popX = cx - POPOVER_WIDTH - POPOVER_OFFSET
        }
        popX = clamp(popX, imageBox.left, imageRight - POPOVER_WIDTH)
        popY = clamp(popY, imageBox.top, imageBottom - POPOVER_HEIGHT_EST)

        return (
          <div key={item.id} className="hotspot-group">
            <button
              type="button"
              className={`hotspot-btn${isOpen ? ' is-active' : ''}`}
              aria-label={item.itemName}
              aria-expanded={isOpen}
              style={
                {
                  '--hs-x': `${cx}px`,
                  '--hs-y': `${cy}px`,
                  '--hs-color': glowColor,
                } as CSSProperties
              }
              onClick={(e) => {
                e.stopPropagation()
                togglePin(item.id)
              }}
              onMouseEnter={() => keepHover(item.id)}
              onMouseLeave={clearHover}
              onFocus={() => keepHover(item.id)}
              onBlur={clearHover}
              onKeyDown={(e) => handleHotspotKey(e, item.id)}
            >
              <span className="hotspot-inner" aria-hidden="true" />
            </button>

            {isOpen && (
              <div
                className="hotspot-popover"
                role="tooltip"
                style={
                  {
                    '--pop-x': `${popX}px`,
                    '--pop-y': `${popY}px`,
                    '--platform-accent': PLATFORM_ACCENTS[item.bestPlatform],
                  } as CSSProperties
                }
                onMouseEnter={() => keepHover(item.id)}
                onMouseLeave={clearHover}
              >
                <div className="hotspot-popover-header">
                  <span className="category-pill">{item.category}</span>
                  <span className="confidence">
                    {Math.round(item.confidence * 100)}% sure
                  </span>
                </div>

                <p className="hotspot-popover-title">{item.itemName}</p>

                <p className="hotspot-popover-meta">
                  {item.color} · {item.style} · {item.materialHint}
                </p>

                {item.budgetNote && (
                  <p className="hotspot-popover-note">{item.budgetNote}</p>
                )}

                <div
                  className="hotspot-popover-tabs"
                  role="tablist"
                  aria-label={`${item.itemName} shops`}
                >
                  {item.platforms.map((deal) => (
                    <button
                      key={deal.platform}
                      type="button"
                      role="tab"
                      aria-selected={deal.platform === activeTab}
                      className={deal.platform === activeTab ? 'active' : ''}
                      style={{ '--accent': PLATFORM_ACCENTS[deal.platform] } as CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation()
                        setTabOverrides((cur) => ({ ...cur, [item.id]: deal.platform }))
                      }}
                    >
                      <span>{PLATFORM_LABELS[deal.platform]}</span>
                      {deal.platform === item.bestPlatform && (
                        <span className="best-badge">Best</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="hotspot-popover-deal">
                  <strong className="hotspot-deal-query">{activeDeal.query}</strong>
                  <div className="hotspot-deal-row">
                    <span className="hotspot-deal-price">
                      ₱{activeDeal.estimatedPricePhp.toLocaleString('en-PH')}
                    </span>
                    <a
                      className="hotspot-deal-link"
                      href={activeDeal.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${PLATFORM_LABELS[activeDeal.platform]} for ${activeDeal.query}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open {PLATFORM_LABELS[activeDeal.platform]} →
                    </a>
                  </div>
                </div>

                <div className="hotspot-popover-bestbuy">
                  <span className="hotspot-bestbuy-label">Best Buy</span>
                  <span className="hotspot-bestbuy-platform">
                    {PLATFORM_LABELS[item.bestPlatform]}
                  </span>
                  <span className="hotspot-bestbuy-reason">{item.bestBuyReason}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
