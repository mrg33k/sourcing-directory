import React from 'react'
import { STATE_PATHS } from '../../lib/usStatesPaths.js'

/**
 * MapPanel — the locator map both profile screens draw.
 *
 * It renders the repo's OWN geography: src/lib/usStatesPaths.js, real albersUsa
 * state paths fitted to a 960x600 viewBox, already shipping on the directory
 * page. No map library is added and the Google Maps key is NOT revived — that
 * key compiles into the public bundle, which is exactly how it leaked before.
 *
 * This is a LOCATOR map, not a street map, and it is drawn as one. The
 * reference art shows a city street grid (Phoenix / Tempe / Mesa with roads and
 * parks); that needs a tile provider we do not have and will not add for a key
 * we cannot ship publicly. State outlines are the true fidelity of our
 * geography, so the panel states it plainly and the card's caption underneath
 * names the city — which is the one thing an outline cannot say.
 *
 * markers: [{ id, x, y, label }] in that same 960x600 space.
 * highlight: ['AZ'] — state codes drawn in the accent tint.
 * viewBox: the crop the card WANTS. Its aspect ratio is honoured as a layout
 *   instruction; its position is treated as a hint, because the framing below
 *   can satisfy the same proportion while actually containing the subject.
 *
 * FRAMING — why a hand-authored crop was not enough.
 * The person card asked for `60 320 400 150`. Arizona spans y 303-439, so that
 * window sliced the top border off the one state the card exists to show. A
 * clipped subject reads as a rendering failure, not as a map. But simply
 * making the window taller is wrong too: the reference's own location map
 * measures 414x130, a 3.18:1 letterbox, and a 16:9 map overshoots that by
 * ~70px, which pushes the whole card row taller and opens an empty band under
 * its shorter neighbours.
 *
 * Both constraints are satisfiable at once, because the subject is short in
 * only ONE axis. So the frame keeps the requested PROPORTION and buys the
 * headroom horizontally: fit the highlighted states plus their pins with a
 * margin, then widen to reach the requested aspect. Arizona ends up whole and
 * dominant inside a letterbox the card row already had space for.
 *
 * The company card highlights two states a continent apart, so the same rule
 * resolves to the full 960x600 country it already drew — that screen is
 * deliberately untouched.
 *
 * SCALE-INVARIANCE. Borders and pins draw at a constant on-screen size
 * regardless of how far the crop is zoomed (non-scaling-stroke in the
 * stylesheet; a pin scaled by crop width here). Without it the same 0.8-unit
 * border is a sub-pixel ghost on the national map and a heavy line on a zoomed
 * one, and the two screens stop looking like one product.
 *
 * A location that is not in the US (Rocket Lab's Mahia complex) simply has no
 * marker; it still appears in the list beside the map. Better an honest gap
 * than a pin dropped in the wrong ocean.
 */

const CANVAS_W = 960
const CANVAS_H = 600

// The reference's own location map is 414x130. Nothing flatter than the
// design itself, or state outlines stop being readable shapes.
const MAX_ASPECT = 3.2

// Breathing room around the subject, as a share of its own size. Below about
// 0.15 the highlighted state touches the frame edge and reads as clipped
// rather than framed, which is exactly what the authored window did.
const SUBJECT_PAD = 0.18

// A lone pin with no highlighted state has no size of its own. Give it about
// one large state's worth of context so the frame is a region, not a dot.
const MIN_SUBJECT = 120

// Pin height as a share of the panel's rendered width. Because the SVG scales
// to fill that width, multiplying by (crop width / canvas width) cancels the
// zoom and leaves the pin the same size on screen on both profile screens.
// The reference draws its pin at roughly 6% of the map's width.
const PIN_SHARE = 4.6

const PIN = 'M0,0 c-3.6,-4.6 -6.4,-8 -6.4,-11.4 a6.4,6.4 0 1 1 12.8,0 C6.4,-8 3.6,-4.6 0,0 z'

// State paths are absolute M/L/Z only (verified against usStatesPaths.js), so
// every number in the string is a coordinate and they alternate x, y.
const boxCache = new Map()

function stateBox(code) {
  if (boxCache.has(code)) return boxCache.get(code)
  const d = STATE_PATHS[code]
  let box = null
  const nums = d ? d.match(/-?\d+(?:\.\d+)?/g) : null
  if (nums && nums.length >= 4) {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i])
      const y = Number(nums[i + 1])
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    box = [x0, y0, x1, y1]
  }
  boxCache.set(code, box)
  return box
}

/** What the frame must contain: the highlighted states and every pin. */
function subjectBox(highlight, markers) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  let found = false

  for (const code of highlight) {
    const b = stateBox(code)
    if (!b) continue
    found = true
    x0 = Math.min(x0, b[0])
    y0 = Math.min(y0, b[1])
    x1 = Math.max(x1, b[2])
    y1 = Math.max(y1, b[3])
  }
  for (const m of markers) {
    const x = Number(m && m.x)
    const y = Number(m && m.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    found = true
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return found ? [x0, y0, x1, y1] : null
}

function frameOf(viewBox, highlight, markers) {
  const vb = String(viewBox).trim().split(/[\s,]+/).map(Number)
  const ok = vb.length === 4 && vb.every((n) => Number.isFinite(n)) && vb[2] > 0 && vb[3] > 0
  const requested = ok ? vb : [0, 0, CANVAS_W, CANVAS_H]

  const subject = subjectBox(highlight, markers)
  if (!subject) return requested

  const aspect = Math.min(requested[2] / requested[3], MAX_ASPECT)
  const sw = Math.max(subject[2] - subject[0], MIN_SUBJECT) * (1 + SUBJECT_PAD * 2)
  const sh = Math.max(subject[3] - subject[1], MIN_SUBJECT) * (1 + SUBJECT_PAD * 2)

  // Buy the headroom on whichever axis is short, then hold the proportion.
  let w = Math.max(sw, sh * aspect)
  let h = w / aspect
  if (w > CANVAS_W) {
    w = CANVAS_W
    h = w / aspect
  }
  if (h > CANVAS_H) {
    h = CANVAS_H
    w = h * aspect
  }

  const cx = (subject[0] + subject[2]) / 2
  const cy = (subject[1] + subject[3]) / 2
  const x = Math.min(Math.max(cx - w / 2, 0), Math.max(CANVAS_W - w, 0))
  const y = Math.min(Math.max(cy - h / 2, 0), Math.max(CANVAS_H - h, 0))
  return [x, y, w, h]
}

// Exported so the framing rule can be checked directly — it is the part of
// this component with actual arithmetic in it, and the part a future crop is
// most likely to trip over.
export { frameOf, stateBox }

export default function MapPanel({ markers = [], highlight = [], viewBox = '0 0 960 600', onExpand, ariaLabel = 'Location map' }) {
  const hot = new Set(highlight)
  const [fx, fy, fw, fh] = frameOf(viewBox, highlight, markers)
  const pinScale = Math.max(0.6, (fw / CANVAS_W) * PIN_SHARE)

  return (
    <div className="osv3p-map">
      <svg
        className="osv3p-map-svg"
        viewBox={`${fx} ${fy} ${fw} ${fh}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
      >
        <g>
          {Object.keys(STATE_PATHS).map((code) => (
            <path
              key={code}
              d={STATE_PATHS[code]}
              className={hot.has(code) ? 'osv3p-map-land osv3p-map-land--active' : 'osv3p-map-land'}
            />
          ))}
        </g>
        {markers.map((m) => (
          <g key={m.id || m.label} transform={`translate(${m.x} ${m.y}) scale(${pinScale})`}>
            <title>{m.label}</title>
            <path className="osv3p-map-pin" d={PIN} />
            <circle className="osv3p-map-pin-dot" cx="0" cy="-11.4" r="2.4" />
          </g>
        ))}
      </svg>
      {onExpand ? (
        <button type="button" className="osv3p-map-expand" onClick={onExpand} aria-label="Expand map">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
