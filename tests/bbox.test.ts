import { describe, it, expect } from 'vitest'
import {
  COORD_SPACE,
  MIN_BBOX_AREA,
  mapBboxToDisplayedRect,
  normalizeBbox,
  type Bbox,
} from '../shared/bbox'

describe('shared bbox constants', () => {
  it('uses the 0–1000 coordinate space contract', () => {
    expect(COORD_SPACE).toBe(1000)
  })

  it('keeps the 5000-unit min area threshold (≈0.5% of frame)', () => {
    expect(MIN_BBOX_AREA).toBe(5_000)
  })
})

describe('normalizeBbox (shared)', () => {
  it('returns null for non-array input', () => {
    expect(normalizeBbox('bad')).toBeNull()
    expect(normalizeBbox(null)).toBeNull()
    expect(normalizeBbox({ 0: 1, 1: 2, 2: 3, 3: 4 })).toBeNull()
  })

  it('returns null for wrong-length arrays', () => {
    expect(normalizeBbox([0, 0, 100])).toBeNull()
    expect(normalizeBbox([0, 0, 100, 200, 300])).toBeNull()
  })

  it('rejects degenerate boxes', () => {
    expect(normalizeBbox([500, 200, 500, 600])).toBeNull()
    expect(normalizeBbox([100, 500, 600, 500])).toBeNull()
    expect(normalizeBbox([600, 200, 500, 600])).toBeNull()
  })

  it('rejects boxes below the area floor', () => {
    expect(normalizeBbox([100, 100, 110, 150])).toBeNull()
  })

  it('clamps and rounds values into 0..1000', () => {
    expect(normalizeBbox([-50, -10, 1200, 1100])).toEqual([0, 0, 1000, 1000])
    expect(normalizeBbox([10.4, 20.7, 500.6, 600.2])).toEqual([10, 21, 501, 600])
  })

  it('accepts a normal box', () => {
    expect(normalizeBbox([100, 200, 500, 700])).toEqual([100, 200, 500, 700])
  })
})

describe('mapBboxToDisplayedRect', () => {
  const fullFrame: Bbox = [0, 0, 1000, 1000]

  it('returns null when natural dimensions are missing (image not loaded)', () => {
    expect(
      mapBboxToDisplayedRect(fullFrame, 0, 0, 400, 600, 'cover'),
    ).toBeNull()
    expect(
      mapBboxToDisplayedRect(fullFrame, 800, 0, 400, 600, 'cover'),
    ).toBeNull()
  })

  it('returns null when display dimensions are zero', () => {
    expect(
      mapBboxToDisplayedRect(fullFrame, 800, 1200, 0, 0, 'cover'),
    ).toBeNull()
  })

  it('square image in square container — bbox center stays at image center', () => {
    const rect = mapBboxToDisplayedRect(
      [400, 400, 600, 600],
      1000,
      1000,
      500,
      500,
      'cover',
    )
    expect(rect).not.toBeNull()
    expect(rect!.centerX).toBeCloseTo(250)
    expect(rect!.centerY).toBeCloseTo(250)
    expect(rect!.width).toBeCloseTo(100)
    expect(rect!.height).toBeCloseTo(100)
  })

  it('portrait image in landscape container (cover) — crops top/bottom, full width visible', () => {
    // 800x1200 image rendered into 400x300 container with cover:
    //   scaleX = 400/800 = 0.5, scaleY = 300/1200 = 0.25 → scale = 0.5
    //   drawn = 400x600, overflow Y = -150 (top), so offsetY = -150.
    const naturalW = 800
    const naturalH = 1200
    const displayW = 400
    const displayH = 300
    // Full-frame box should clip to the visible display area.
    const full = mapBboxToDisplayedRect(
      fullFrame,
      naturalW,
      naturalH,
      displayW,
      displayH,
      'cover',
    )
    expect(full).not.toBeNull()
    expect(full!.left).toBeCloseTo(0)
    expect(full!.top).toBeCloseTo(0)
    expect(full!.width).toBeCloseTo(displayW)
    expect(full!.height).toBeCloseTo(displayH)

    // A box centered horizontally and vertically should land in the visible center.
    //   bbox in natural px: 320..480 x 480..720 (160 wide × 240 tall)
    //   displayed: 80 × 120, center (200, 150) after scale 0.5 and offsetY=-150.
    const center = mapBboxToDisplayedRect(
      [400, 400, 600, 600],
      naturalW,
      naturalH,
      displayW,
      displayH,
      'cover',
    )
    expect(center).not.toBeNull()
    expect(center!.centerX).toBeCloseTo(200)
    expect(center!.centerY).toBeCloseTo(150)
    expect(center!.width).toBeCloseTo(80)
    expect(center!.height).toBeCloseTo(120)
  })

  it('landscape image in portrait container (cover) — crops sides, full height visible', () => {
    // 1200x800 image rendered into 300x400 container with cover:
    //   scaleX = 300/1200 = 0.25, scaleY = 400/800 = 0.5 → scale = 0.5
    //   drawn = 600x400, overflow X = -150 (left), offsetX = -150.
    const naturalW = 1200
    const naturalH = 800
    const displayW = 300
    const displayH = 400

    const full = mapBboxToDisplayedRect(
      fullFrame,
      naturalW,
      naturalH,
      displayW,
      displayH,
      'cover',
    )
    expect(full).not.toBeNull()
    expect(full!.left).toBeCloseTo(0)
    expect(full!.top).toBeCloseTo(0)
    expect(full!.width).toBeCloseTo(displayW)
    expect(full!.height).toBeCloseTo(displayH)

    //   bbox in natural px: 480..720 x 320..480 (240 wide × 160 tall)
    //   displayed: 120 × 80, center (150, 200) after scale 0.5 and offsetX=-150.
    const center = mapBboxToDisplayedRect(
      [400, 400, 600, 600],
      naturalW,
      naturalH,
      displayW,
      displayH,
      'cover',
    )
    expect(center).not.toBeNull()
    expect(center!.centerX).toBeCloseTo(150)
    expect(center!.centerY).toBeCloseTo(200)
    expect(center!.width).toBeCloseTo(120)
    expect(center!.height).toBeCloseTo(80)
  })

  it('cover mode — a hotspot on a cropped edge collapses to a zero-width slice (no offscreen render)', () => {
    const naturalW = 800
    const naturalH = 1200
    const displayW = 400
    const displayH = 300
    // Box at the very top of the image — entirely in the cropped strip.
    const rect = mapBboxToDisplayedRect(
      [0, 100, 80, 700],
      naturalW,
      naturalH,
      displayW,
      displayH,
      'cover',
    )
    expect(rect).not.toBeNull()
    expect(rect!.height).toBe(0)
    expect(rect!.top).toBe(0)
    expect(rect!.left).toBeGreaterThanOrEqual(0)
    expect(rect!.left + rect!.width).toBeLessThanOrEqual(displayW)
  })

  it('contain mode — letterboxes a landscape image inside a portrait container', () => {
    // 1200x800 image in 300x400 contain: scale = min(0.25, 0.5) = 0.25
    //   drawn = 300x200, offsetY = (400-200)/2 = 100, offsetX = 0.
    const naturalW = 1200
    const naturalH = 800
    const displayW = 300
    const displayH = 400

    const full = mapBboxToDisplayedRect(
      fullFrame,
      naturalW,
      naturalH,
      displayW,
      displayH,
      'contain',
    )
    expect(full).not.toBeNull()
    expect(full!.left).toBeCloseTo(0)
    expect(full!.top).toBeCloseTo(100)
    expect(full!.width).toBeCloseTo(300)
    expect(full!.height).toBeCloseTo(200)

    //   bbox in natural px: 480..720 × 320..480 (240w × 160h)
    //   displayed under contain scale 0.25: 60w × 40h, center (150, 200).
    const center = mapBboxToDisplayedRect(
      [400, 400, 600, 600],
      naturalW,
      naturalH,
      displayW,
      displayH,
      'contain',
    )
    expect(center).not.toBeNull()
    expect(center!.centerX).toBeCloseTo(150)
    expect(center!.centerY).toBeCloseTo(200)
    expect(center!.width).toBeCloseTo(60)
    expect(center!.height).toBeCloseTo(40)
  })

  it('contain mode — boxes never overflow the displayed container', () => {
    const rect = mapBboxToDisplayedRect(
      fullFrame,
      900,
      600,
      400,
      400,
      'contain',
    )
    expect(rect).not.toBeNull()
    expect(rect!.left).toBeGreaterThanOrEqual(0)
    expect(rect!.top).toBeGreaterThanOrEqual(0)
    expect(rect!.left + rect!.width).toBeLessThanOrEqual(400)
    expect(rect!.top + rect!.height).toBeLessThanOrEqual(400)
  })
})
