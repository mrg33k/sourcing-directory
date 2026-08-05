import React, { useMemo } from 'react'
import { STATE_PATHS } from '../../lib/usStatesPaths.js'
import { stateBox } from '../../components/osv3/MapPanel.jsx'

/**
 * EcoBubbleMap — Arizona, with one count bubble per city.
 *
 * WHAT THIS IS NOT, AND WHY.
 * The reference art for this screen is an interactive Google street map with
 * dropped pins. We are not drawing that, for two reasons that are not
 * negotiable rather than convenient:
 *
 *   1. There is not a single coordinate in the database. No lat/lng column
 *      exists on any table; organizations carry a free-text city and state and
 *      nothing else. A street map needs a per-address position we do not have,
 *      so every pin on it would be a guess.
 *   2. MapPanel.jsx:8-11 records the standing decision that no map library is
 *      added and the Google Maps key is not revived, because a VITE_-prefixed
 *      key compiles into the public JavaScript bundle where anyone can lift it.
 *      That has already happened once on this project.
 *
 * Look closely at the reference and it is not plotting individual pins either —
 * it is showing clustered count bubbles over cities. That is a city-level
 * choropleth, and a city-level choropleth is exactly what the real data
 * supports: 165 organizations across 13 Arizona cities. So this draws the thing
 * the reference was actually communicating, from data that is actually true.
 *
 * GEOGRAPHY. The outlines are the repo's own: src/lib/usStatesPaths.js, real
 * albersUsa paths on a 960x600 canvas, already shipping on two profile screens.
 * City positions come through the same projection (src/lib/azCityCoords.js).
 *
 * FRAMING. MapPanel exports frameOf, but its rule is tuned for a 3.2:1 letterbox
 * strip on a profile card and pads the subject by 18% — at this panel's aspect
 * that leaves Arizona filling under half the width. This panel exists to be a
 * map, so the subject dominates: 8% padding, then widen to the card's aspect.
 * stateBox IS reused, because that is the part with arithmetic in it.
 *
 * COLLISION. Phoenix, Scottsdale, Tempe, Mesa, Chandler, Gilbert, Glendale,
 * Peoria and Queen Creek sit inside about nine canvas units of each other —
 * that is the East Valley, and it is the true shape of this ecosystem. Drawn at
 * true position they would be one unreadable stack. So bubbles are relaxed
 * apart, largest first, with a spring back toward the true point, and any
 * bubble that ends up displaced draws a hairline back to where it really is.
 * Nothing is merged and no count is combined: every city keeps its own number.
 *
 * props:
 *   bubbles   [{ id, label, count, x, y }] — x/y already in canvas units
 *   maxCount  the count the largest bubble represents
 *   aspect    width / height of the panel, so the frame matches the box
 *   textScale SVG text scales with the viewBox, so a label sized for a 700px
 *             panel is 8px on a phone. The caller multiplies it back up.
 *   selected  id of the bubble currently filtering the list, or ''
 *   onSelect  (id) => void
 */

const R_MIN = 3.8
const R_MAX = 8.6
const SUBJECT_PAD = 0.05
const CANVAS_W = 960
const CANVAS_H = 600
const RELAX_PASSES = 160

// Roboto 600 averages a little over half its point size per glyph. This only
// has to be close: it sizes the box a label is tested for collisions in, and
// erring wide costs a label, not a wrong-looking one.
const GLYPH_ADVANCE = 0.56
const LABEL_GAP = 1.4

function frameFor(aspect) {
  const az = stateBox('AZ') || [189, 303, 305, 439]
  const cx = (az[0] + az[2]) / 2
  const cy = (az[1] + az[3]) / 2
  const sw = (az[2] - az[0]) * (1 + SUBJECT_PAD * 2)
  const sh = (az[3] - az[1]) * (1 + SUBJECT_PAD * 2)
  let w = Math.max(sw, sh * aspect)
  let h = w / aspect
  if (w > CANVAS_W) { w = CANVAS_W; h = w / aspect }
  if (h > CANVAS_H) { h = CANVAS_H; w = h * aspect }
  const x = Math.min(Math.max(cx - w / 2, 0), Math.max(CANVAS_W - w, 0))
  const y = Math.min(Math.max(cy - h / 2, 0), Math.max(CANVAS_H - h, 0))
  return [x, y, w, h]
}

/**
 * Area-proportional: the eye reads a circle by its area, so the radius follows
 * the square root of the count. A floor keeps a count of one from becoming a
 * dot too small to carry its own numeral.
 */
function radiusFor(count, max) {
  const share = max > 0 ? Math.min(1, Math.max(0, count / max)) : 0
  return R_MIN + (R_MAX - R_MIN) * Math.sqrt(share)
}

function relax(seed, frame) {
  const nodes = seed.map((b) => ({ ...b, cx: b.x, cy: b.y }))
  const [fx, fy, fw, fh] = frame
  for (let pass = 0; pass < RELAX_PASSES; pass += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = b.cx - a.cx
        let dy = b.cy - a.cy
        let d = Math.sqrt(dx * dx + dy * dy)
        const want = a.r + b.r + 1.1
        if (d >= want) continue
        if (d < 0.0001) {
          // Perfectly coincident: break the tie deterministically, not randomly,
          // so the same data always draws the same map.
          dx = (i % 2 === 0 ? 1 : -1) * 0.01
          dy = 0.01
          d = 0.0142
        }
        // The bigger circle moves less: the city with the most organizations
        // keeps the position closest to where it really is.
        const push = (want - d) / d
        const wa = b.r / (a.r + b.r)
        const wb = a.r / (a.r + b.r)
        a.cx -= dx * push * wa
        a.cy -= dy * push * wa
        b.cx += dx * push * wb
        b.cy += dy * push * wb
      }
    }
    // Spring home, so a bubble never drifts further than the crowding requires.
    for (const nd of nodes) {
      nd.cx += (nd.x - nd.cx) * 0.06
      nd.cy += (nd.y - nd.cy) * 0.06
      nd.cx = Math.min(Math.max(nd.cx, fx + nd.r + 1), fx + fw - nd.r - 1)
      nd.cy = Math.min(Math.max(nd.cy, fy + nd.r + 1), fy + fh - nd.r - 1)
    }
  }
  return nodes
}

/** Does an axis-aligned box overlap a circle? Clamp the centre into the box. */
function boxHitsCircle(box, cx, cy, r) {
  const nx = Math.min(Math.max(cx, box[0]), box[2])
  const ny = Math.min(Math.max(cy, box[1]), box[3])
  return Math.hypot(cx - nx, cy - ny) < r
}

function boxHitsBox(a, b) {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
}

/**
 * Label placement.
 *
 * The first cut of this screen dropped every name straight under its bubble and
 * the East Valley turned into "Ter" sitting on top of "Scottsdale" sitting on
 * top of a circle. So each name now gets four candidate positions — below,
 * above, right, left — and takes the first that clears every bubble, every
 * label already placed, and the edge of the frame. A name with no clear
 * position is not drawn at all: an unreadable label is worse than none, the
 * bubble still answers on hover and click, and the Top locations panel beside
 * the map names every city in order anyway.
 *
 * Biggest count goes first, so if something has to go unlabelled it is a city
 * with one organization in it, not Phoenix.
 */
function placeLabels(nodes, frame, fontSize) {
  const [fx, fy, fw, fh] = frame
  const boxes = []
  const out = new Map()
  const half = fontSize / 2

  for (const nd of nodes.slice().sort((a, b) => b.count - a.count)) {
    const w = Math.max(fontSize * 2, nd.label.length * GLYPH_ADVANCE * fontSize)
    const gap = LABEL_GAP + nd.r
    const cands = [
      { x: nd.cx, y: nd.cy + gap + fontSize * 0.85, anchor: 'middle',
        box: [nd.cx - w / 2, nd.cy + gap, nd.cx + w / 2, nd.cy + gap + fontSize] },
      { x: nd.cx, y: nd.cy - gap - fontSize * 0.2, anchor: 'middle',
        box: [nd.cx - w / 2, nd.cy - gap - fontSize, nd.cx + w / 2, nd.cy - gap] },
      { x: nd.cx + gap, y: nd.cy + fontSize * 0.34, anchor: 'start',
        box: [nd.cx + gap, nd.cy - half, nd.cx + gap + w, nd.cy + half] },
      { x: nd.cx - gap, y: nd.cy + fontSize * 0.34, anchor: 'end',
        box: [nd.cx - gap - w, nd.cy - half, nd.cx - gap, nd.cy + half] },
    ]

    for (const cand of cands) {
      const b = cand.box
      if (b[0] < fx || b[2] > fx + fw || b[1] < fy || b[3] > fy + fh) continue
      if (nodes.some((o) => boxHitsCircle(b, o.cx, o.cy, o.r + 0.6))) continue
      if (boxes.some((p) => boxHitsBox(b, p))) continue
      boxes.push(b)
      out.set(nd.id, cand)
      break
    }
  }
  return out
}

export default function EcoBubbleMap({
  bubbles = [],
  maxCount = 0,
  aspect = 1.5,
  textScale = 1,
  selected = '',
  onSelect,
  ariaLabel = 'Organizations by Arizona city',
}) {
  const frame = useMemo(() => frameFor(aspect), [aspect])

  const nodes = useMemo(() => {
    const seed = bubbles
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((b) => ({ ...b, r: radiusFor(b.count, maxCount) }))
    return relax(seed, frame)
  }, [bubbles, maxCount, frame])

  const labelSize = 4.2 * textScale
  const labels = useMemo(
    () => placeLabels(nodes, frame, labelSize),
    [nodes, frame, labelSize],
  )

  const [fx, fy, fw, fh] = frame

  return (
    <svg
      className="osv3-ecomap-svg"
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
            className={code === 'AZ' ? 'osv3p-map-land osv3p-map-land--active' : 'osv3p-map-land'}
          />
        ))}
      </g>

      {/* Leader lines first, so a bubble always covers its own tether. */}
      <g>
        {nodes.map((nd) => (
          Math.hypot(nd.cx - nd.x, nd.cy - nd.y) > nd.r * 0.5 ? (
            <line
              key={`lead-${nd.id}`}
              className="osv3-ecomap-lead"
              x1={nd.x}
              y1={nd.y}
              x2={nd.cx}
              y2={nd.cy}
            />
          ) : null
        ))}
        {nodes.map((nd) => (
          <circle key={`true-${nd.id}`} className="osv3-ecomap-truedot" cx={nd.x} cy={nd.y} r="0.9" />
        ))}
      </g>

      <g>
        {nodes.map((nd) => {
          const on = selected === nd.id
          const label = labels.get(nd.id)
          return (
            <g
              key={nd.id}
              className={on ? 'osv3-ecomap-bubble osv3-ecomap-bubble--on' : 'osv3-ecomap-bubble'}
              role="button"
              tabIndex={0}
              aria-label={`${nd.label}: ${nd.count} organization${nd.count === 1 ? '' : 's'}`}
              aria-pressed={on}
              onClick={() => onSelect && onSelect(on ? '' : nd.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect && onSelect(on ? '' : nd.id)
                }
              }}
            >
              <title>{`${nd.label} — ${nd.count} organization${nd.count === 1 ? '' : 's'}`}</title>
              <circle className="osv3-ecomap-disc" cx={nd.cx} cy={nd.cy} r={nd.r} />
              <text
                className="osv3-ecomap-count"
                x={nd.cx}
                y={nd.cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(3.2, nd.r * 0.92)}
              >
                {nd.count}
              </text>
              {label ? (
                <text
                  className="osv3-ecomap-name"
                  x={label.x}
                  y={label.y}
                  textAnchor={label.anchor}
                  fontSize={labelSize}
                >
                  {nd.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
