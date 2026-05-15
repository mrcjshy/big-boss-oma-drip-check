/**
 * Single source of truth for bounding-box math shared between the client UI
 * and the server analysis pipeline.
 *
 * Coordinate contract (do not break):
 *   - bbox is `[ymin, xmin, ymax, xmax]`
 *   - each value is an integer in 0..1000 normalized over the FULL original
 *     uploaded image pixels (not any cropped preview).
 *
 * Keeping this in one module prevents the client and server from drifting
 * on hardening rules, area thresholds, or coordinate space.
 */

/** Normalized coordinate space used by Gemini's bbox output. */
export const COORD_SPACE = 1000

/**
 * Minimum bbox area (in normalized 0..1000 units) below which a detection is
 * rejected as noise. 5_000 ≈ 0.5% of the image; smaller boxes are almost
 * always misfires that produce dot-sized hotspots over nothing.
 */
export const MIN_BBOX_AREA = 5_000

export type Bbox = [number, number, number, number]

export type DisplayedRect = {
  left: number
  top: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export type FitMode = 'cover' | 'contain'

/**
 * Coerce and validate a raw bbox candidate from a model response.
 *
 * Returns `null` for degenerate / unusable boxes so callers can `.flatMap`
 * them out cleanly. Values are clamped to `[0, COORD_SPACE]` and rounded to
 * integers.
 */
export const normalizeBbox = (rawBbox: unknown): Bbox | null => {
  if (!Array.isArray(rawBbox) || rawBbox.length !== 4) return null

  const coerced = rawBbox.map((value) =>
    Math.round(Math.min(COORD_SPACE, Math.max(0, Number(value) || 0))),
  ) as [number, number, number, number]

  const [ymin, xmin, ymax, xmax] = coerced
  if (ymax <= ymin || xmax <= xmin) return null

  const area = (ymax - ymin) * (xmax - xmin)
  if (area < MIN_BBOX_AREA) return null

  return [ymin, xmin, ymax, xmax]
}

/**
 * Map a normalized bbox onto an `<img>` element's *displayed* pixel space
 * while accounting for `object-fit: cover` or `object-fit: contain` cropping.
 *
 * The model returns coordinates over the original image pixels
 * (`naturalWidth` × `naturalHeight`). The browser scales the image to
 * `displayW` × `displayH` and either:
 *   - `cover`: scales by `max(displayW/naturalW, displayH/naturalH)` so the
 *     image fills the container; the overflowing axis is clipped equally on
 *     both sides (offset is negative).
 *   - `contain`: scales by `min(...)` so the whole image fits; the shorter
 *     axis is letterboxed (offset is positive).
 *
 * Returns `null` when natural or display dimensions are zero (image not
 * loaded yet) so callers can early-out without surfacing a hotspot at 0,0.
 *
 * The returned rect is clamped to the displayed container — under `cover`
 * this means a bbox whose center sits in the cropped region collapses to a
 * 0-width edge slice rather than rendering offscreen.
 */
export const mapBboxToDisplayedRect = (
  bbox: Bbox,
  naturalW: number,
  naturalH: number,
  displayW: number,
  displayH: number,
  fit: FitMode,
): DisplayedRect | null => {
  if (naturalW <= 0 || naturalH <= 0) return null
  if (displayW <= 0 || displayH <= 0) return null

  const [ymin, xmin, ymax, xmax] = bbox

  const naturalLeft = (xmin / COORD_SPACE) * naturalW
  const naturalTop = (ymin / COORD_SPACE) * naturalH
  const naturalRight = (xmax / COORD_SPACE) * naturalW
  const naturalBottom = (ymax / COORD_SPACE) * naturalH

  const scaleX = displayW / naturalW
  const scaleY = displayH / naturalH
  const scale = fit === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)

  const drawnW = naturalW * scale
  const drawnH = naturalH * scale

  const offsetX = (displayW - drawnW) / 2
  const offsetY = (displayH - drawnH) / 2

  const leftRaw = naturalLeft * scale + offsetX
  const topRaw = naturalTop * scale + offsetY
  const rightRaw = naturalRight * scale + offsetX
  const bottomRaw = naturalBottom * scale + offsetY

  const left = clamp(leftRaw, 0, displayW)
  const top = clamp(topRaw, 0, displayH)
  const right = clamp(rightRaw, 0, displayW)
  const bottom = clamp(bottomRaw, 0, displayH)

  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)

  const centerXRaw = (leftRaw + rightRaw) / 2
  const centerYRaw = (topRaw + bottomRaw) / 2
  const centerX = clamp(centerXRaw, 0, displayW)
  const centerY = clamp(centerYRaw, 0, displayH)

  return { left, top, width, height, centerX, centerY }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))
