/**
 * cityGeography.js — reference geography: real city coordinates, and the one
 * piece of arithmetic that puts them on the map the repo already draws.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * No table in this database has a latitude or a longitude. Organizations carry
 * free-text `city` + `state` and nothing else. So a map with city bubbles needs
 * two things neither the database nor the component library provides: where
 * each city IS, and where that lands inside MapPanel's 960x600 canvas.
 *
 * The coordinates below are REFERENCE GEOGRAPHY, not invented data. Phoenix
 * sits at 33.4484N 112.0740W whoever is asking; that is a published fact about
 * the world, the same class of thing as src/lib/usStatesPaths.js (166KB of real
 * state outlines, already shipping). Hardcoding it is correct. What would NOT
 * be correct — and is not done here — is inventing a coordinate for a city that
 * is not in this table. `markerFor()` returns null instead, the city gets no
 * bubble, and the screen says how many organizations that accounted for.
 *
 * ---------------------------------------------------------------------------
 * THE PROJECTION, AND HOW IT WAS VERIFIED
 * ---------------------------------------------------------------------------
 * MapPanel draws src/lib/usStatesPaths.js in a 960x600 box. Those paths are
 * us-atlas 10m state outlines put through d3.geoAlbersUsa() and then fitted to
 * that box — so a lat/lng only lands in the right place if it goes through the
 * SAME projection with the SAME fit. That fit is not the library default, and
 * guessing it wrong puts Phoenix in the Pacific.
 *
 * albersUsa's lower-48 branch is a conic equal-area projection: parallels
 * 29.5 / 45.5, rotate 96 west, centre -0.6 / 38.7. That much is d3's published
 * definition and is implemented verbatim below. The scale and translate were
 * MEASURED off the shipped path data rather than assumed:
 *
 *   Arizona's outline contains three vertices whose true coordinates are known
 *   to the metre because they are surveyed corners —
 *     AZ/NV/UT tripoint  (-114.0506, 37.0004)  ->  path vertex 221.0, 303.3
 *     Four Corners       (-109.0452, 37.0004)  ->  path vertex 304.9, 317.2
 *     AZ/NM/Mexico       (-109.0452, 31.3322)  ->  path vertex 288.1, 438.6
 *   Fitting scale + translate to those three points leaves a residual under
 *   0.04px on all three, which is below the 0.1px rounding in the path data
 *   itself. So the fit is not approximately right, it is exact.
 *
 * Independently checked afterwards against four states this file never fitted:
 *   Minnesota's NW Angle  (-95.1536, 49.3844) -> y 65.7 · MN path min y 65.7
 *   Brownsville, TX       (-97.4975, 25.8400) -> y 572.4 · TX path max y 572.3
 *   Cape Mendocino, CA    (-124.4090, 40.4400) -> x 72.4 · CA path min x 72.0
 *   West Quoddy Head, ME  (-66.9500, 44.8150) -> x 960.6 · ME path max x 960.0
 * Four states, four sub-pixel agreements, none of them used in the fit.
 *
 * NO MAP LIBRARY AND NO MAP KEY. MapPanel.jsx:8-11 records the reason: a
 * VITE_-prefixed key compiles into the public bundle, which is how the last one
 * leaked. This is 30 lines of trigonometry instead, and it ships nothing.
 */

const RADIANS = Math.PI / 180

/* d3.geoAlbers(): conicEqualArea, parallels [29.5, 45.5], rotate [96, 0],
   center [-0.6, 38.7]. The constants below are that raw projection, precomputed
   once. */
const PHI_0 = 29.5 * RADIANS
const PHI_1 = 45.5 * RADIANS
const SIN_PHI_0 = Math.sin(PHI_0)
const CONE = (SIN_PHI_0 + Math.sin(PHI_1)) / 2
const C = 1 + SIN_PHI_0 * (2 * CONE - SIN_PHI_0)
const R0 = Math.sqrt(C) / CONE
const ROTATE_LON = 96

/* Measured off the shipped path data — see the header. */
const FIT_SCALE = 1230.2165
const FIT_TX = 515.7739
const FIT_TY = 295.4629

function conicEqualAreaRaw(lambda, phi) {
  const r = Math.sqrt(C - 2 * CONE * Math.sin(phi)) / CONE
  const x = lambda * CONE
  return [r * Math.sin(x), R0 - r * Math.cos(x)]
}

/* d3's `center` is expressed in the ROTATED frame, which is why -0.6 goes in
   un-rotated here while every input point gets +96 applied. Getting this one
   backwards is the difference between Arizona and the middle of the Atlantic. */
const CENTER = conicEqualAreaRaw(-0.6 * RADIANS, 38.7 * RADIANS)

/**
 * A longitude/latitude to a point in MapPanel's 960x600 canvas.
 * Returns null for anything that is not a finite pair of numbers.
 */
export function projectToMapCanvas(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  let rotated = lon + ROTATE_LON
  while (rotated > 180) rotated -= 360
  while (rotated < -180) rotated += 360
  const p = conicEqualAreaRaw(rotated * RADIANS, lat * RADIANS)
  return {
    x: FIT_TX + FIT_SCALE * (p[0] - CENTER[0]),
    y: FIT_TY - FIT_SCALE * (p[1] - CENTER[1]),
  }
}

/* ------------------------------------------------------------------------- *
 * The table
 * ------------------------------------------------------------------------- *
 * Arizona municipalities, city-centre coordinates. The first thirteen are every
 * Arizona city that currently has an organization in the directory; the rest
 * are the next-largest municipalities in the state, present so that the day one
 * of them registers, the map draws it without a code change.
 *
 * A city that is NOT here gets no marker. That is the design: an unknown place
 * is a gap the screen names, never a pin dropped somewhere plausible.
 */
export const AZ_CITIES = {
  // In the directory today
  phoenix: { label: 'Phoenix', lat: 33.4484, lon: -112.0740 },
  tucson: { label: 'Tucson', lat: 32.2226, lon: -110.9747 },
  scottsdale: { label: 'Scottsdale', lat: 33.4942, lon: -111.9261 },
  chandler: { label: 'Chandler', lat: 33.3062, lon: -111.8413 },
  tempe: { label: 'Tempe', lat: 33.4255, lon: -111.9400 },
  mesa: { label: 'Mesa', lat: 33.4152, lon: -111.8315 },
  gilbert: { label: 'Gilbert', lat: 33.3528, lon: -111.7890 },
  glendale: { label: 'Glendale', lat: 33.5387, lon: -112.1860 },
  peoria: { label: 'Peoria', lat: 33.5806, lon: -112.2374 },
  flagstaff: { label: 'Flagstaff', lat: 35.1983, lon: -111.6513 },
  yuma: { label: 'Yuma', lat: 32.6927, lon: -114.6277 },
  'casa grande': { label: 'Casa Grande', lat: 32.8795, lon: -111.7574 },
  'queen creek': { label: 'Queen Creek', lat: 33.2487, lon: -111.6343 },

  // Not in the directory yet — the next-largest Arizona municipalities.
  surprise: { label: 'Surprise', lat: 33.6292, lon: -112.3680 },
  goodyear: { label: 'Goodyear', lat: 33.4353, lon: -112.3576 },
  buckeye: { label: 'Buckeye', lat: 33.3703, lon: -112.5838 },
  avondale: { label: 'Avondale', lat: 33.4356, lon: -112.3496 },
  maricopa: { label: 'Maricopa', lat: 33.0581, lon: -112.0476 },
  'apache junction': { label: 'Apache Junction', lat: 33.4151, lon: -111.5495 },
  'oro valley': { label: 'Oro Valley', lat: 32.3909, lon: -110.9665 },
  marana: { label: 'Marana', lat: 32.4367, lon: -111.2255 },
  'prescott valley': { label: 'Prescott Valley', lat: 34.6100, lon: -112.3157 },
  prescott: { label: 'Prescott', lat: 34.5400, lon: -112.4685 },
  'lake havasu city': { label: 'Lake Havasu City', lat: 34.4839, lon: -114.3225 },
  'sierra vista': { label: 'Sierra Vista', lat: 31.5455, lon: -110.2773 },
  kingman: { label: 'Kingman', lat: 35.1894, lon: -114.0530 },
  'bullhead city': { label: 'Bullhead City', lat: 35.1478, lon: -114.5683 },
  'fountain hills': { label: 'Fountain Hills', lat: 33.6117, lon: -111.7174 },
  'paradise valley': { label: 'Paradise Valley', lat: 33.5312, lon: -111.9426 },
  sahuarita: { label: 'Sahuarita', lat: 31.9576, lon: -110.9557 },
  nogales: { label: 'Nogales', lat: 31.3404, lon: -110.9343 },
  sedona: { label: 'Sedona', lat: 34.8697, lon: -111.7610 },
  payson: { label: 'Payson', lat: 34.2309, lon: -111.3251 },
  florence: { label: 'Florence', lat: 33.0314, lon: -111.3873 },
  coolidge: { label: 'Coolidge', lat: 32.9781, lon: -111.5176 },
  eloy: { label: 'Eloy', lat: 32.7559, lon: -111.5548 },
  'san luis': { label: 'San Luis', lat: 32.4870, lon: -114.7822 },
  douglas: { label: 'Douglas', lat: 31.3445, lon: -109.5453 },
  safford: { label: 'Safford', lat: 32.8340, lon: -109.7076 },
  'show low': { label: 'Show Low', lat: 34.2542, lon: -110.0298 },
  page: { label: 'Page', lat: 36.9147, lon: -111.4558 },
  winslow: { label: 'Winslow', lat: 35.0242, lon: -110.6974 },
  cottonwood: { label: 'Cottonwood', lat: 34.7392, lon: -112.0099 },
  'camp verde': { label: 'Camp Verde', lat: 34.5636, lon: -111.8543 },
  globe: { label: 'Globe', lat: 33.3942, lon: -110.7865 },
  wickenburg: { label: 'Wickenburg', lat: 33.9686, lon: -112.7296 },
  parker: { label: 'Parker', lat: 34.1500, lon: -114.2891 },
  benson: { label: 'Benson', lat: 31.9679, lon: -110.2945 },
  willcox: { label: 'Willcox', lat: 32.2529, lon: -109.8320 },
  'litchfield park': { label: 'Litchfield Park', lat: 33.4934, lon: -112.3580 },
  'el mirage': { label: 'El Mirage', lat: 33.6131, lon: -112.3241 },
  tolleson: { label: 'Tolleson', lat: 33.4501, lon: -112.2593 },
}

/* State values that mean Arizona in this data. `directory_companies.state`
   holds two-letter codes for 164 rows and the word "Arizona" for none today,
   but the signup form accepts free text, so both are honoured. */
const AZ_STATES = new Set(['az', 'arizona'])

export function isArizona(state) {
  return AZ_STATES.has(String(state || '').trim().toLowerCase())
}

/**
 * Normalise a free-text city field to a lookup key.
 *
 * The one merge that matters: this data holds BOTH "Phoenix" and "Phoenix, AZ"
 * as separate values, and both "Scottsdale" and "Scottsdale, AZ". Left alone
 * they bucket separately and the map draws Phoenix at 33 when it is 34. The
 * trailing state is stripped, which is the only transformation applied — no
 * fuzzy matching, no spelling correction, nothing that could silently merge two
 * genuinely different places.
 *
 * Returns '' for a value that is not a city at all. One row has the literal
 * string "Arizona" in its city column; that is a state, it cannot be placed,
 * and it must not become a bubble somewhere in the middle of the map.
 */
export function normalizeCity(city) {
  const raw = String(city || '').trim().toLowerCase()
  if (!raw) return ''
  const stripped = raw.replace(/[\s,]+(az|arizona)$/, '').trim()
  if (!stripped) return ''
  if (AZ_STATES.has(stripped)) return '' // "Arizona" is not a city
  return stripped
}

/** Display form of a normalised key: the table's own label when we know the
 *  city, otherwise Title Case of what the member typed. */
export function cityLabel(key) {
  if (AZ_CITIES[key]) return AZ_CITIES[key].label
  return key.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
}

/**
 * A MapPanel marker for a normalised city key, or null when the city is not in
 * the table. Null is the honest answer and the caller must handle it — see the
 * header.
 */
export function markerFor(key, extra = {}) {
  const city = AZ_CITIES[key]
  if (!city) return null
  const p = projectToMapCanvas(city.lon, city.lat)
  if (!p) return null
  return { id: key, x: p.x, y: p.y, label: city.label, ...extra }
}

export default { AZ_CITIES, projectToMapCanvas, markerFor, normalizeCity, cityLabel, isArizona }
