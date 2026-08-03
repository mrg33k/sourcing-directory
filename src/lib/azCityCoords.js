/**
 * Arizona city coordinates, and the projection that puts them on the map the
 * repo already draws.
 *
 * WHY THIS FILE EXISTS
 * There is not one latitude or longitude anywhere in the database. Every
 * organization carries a free-text `city` and `state` and nothing else. So a
 * map keyed to real places needs a lookup, and this is it: reference geography
 * (the published centre of a real city), not invented data. Nothing here is a
 * count, a share, or a measurement — those all come from the database at load.
 *
 * THE PROJECTION
 * src/lib/usStatesPaths.js holds real albersUsa state outlines fitted to a
 * 960x600 canvas (us-atlas@3, states-10m). To drop a city onto those outlines a
 * lat/lng has to travel through the SAME projection the paths were drawn with:
 * d3.geoConicEqualArea().parallels([29.5, 45.5]).rotate([96, 0]) — which is what
 * d3.geoAlbersUsa uses for the lower 48 — followed by the canvas scale and
 * translate. d3 is not a dependency and is not being added; the raw formula is
 * eleven lines of trigonometry and it is inlined below.
 *
 * The scale/translate were not guessed. They were solved by least squares
 * against three states whose borders are meridians and parallels, so their true
 * geographic bounding box is known exactly: Colorado (37-41 N, 109.0452-102.0416 W),
 * Wyoming (41-45 N, 111.0546-104.0522 W) and Utah (36.9979-42.0016 N,
 * 114.0529-109.0410 W). Their projected boxes were fitted to the boxes their
 * actual paths occupy on the canvas.
 *
 * Worst residual across those three states: 2.5 canvas units, about 7 screen
 * pixels at the zoom the Arizona map renders at. That is the honest accuracy of
 * this file: good enough to place a city-level count bubble on the right city,
 * not good enough to place a street address. The dot is a city, and the label
 * says which one.
 */

const DEG = Math.PI / 180

// d3.geoAlbersUsa's lower-48 conic: parallels 29.5 / 45.5, rotated 96 west.
const PHI_0 = 29.5 * DEG
const PHI_1 = 45.5 * DEG
const SIN_0 = Math.sin(PHI_0)
const CONE = (SIN_0 + Math.sin(PHI_1)) / 2
const C = 1 + SIN_0 * (2 * CONE - SIN_0)
const RHO_0 = Math.sqrt(C) / CONE

// Solved, not guessed — see the header. Uniform scale: the fit came out
// isotropic to within 0.03%, which is what a fitSize() refit should look like.
const SCALE = 1229.95
const TRANSLATE_X = 525.11
const TRANSLATE_Y = 1090.45

export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 600

/** lat/lng in degrees -> [x, y] in the 960x600 canvas usStatesPaths.js uses. */
export function projectToCanvas(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const lambda = (lng + 96) * DEG * CONE
  const rho = Math.sqrt(C - 2 * CONE * Math.sin(lat * DEG)) / CONE
  const px = rho * Math.sin(lambda)
  const py = RHO_0 - rho * Math.cos(lambda)
  return [SCALE * px + TRANSLATE_X, TRANSLATE_Y - SCALE * py]
}

/**
 * Arizona cities, keyed by lowercase name. Centre-of-city coordinates.
 *
 * The list is deliberately wider than the 13 cities that have an organization
 * in them today, so a city added tomorrow lands on the map instead of falling
 * off it silently. A city NOT in this table is not plotted and is counted in
 * the "not placed" figure the map states out loud — a missing pin is reported,
 * never faked at the centre of the state.
 */
export const AZ_CITIES = {
  'phoenix': [33.4484, -112.0740],
  'tucson': [32.2226, -110.9747],
  'mesa': [33.4152, -111.8315],
  'chandler': [33.3062, -111.8413],
  'scottsdale': [33.4942, -111.9261],
  'glendale': [33.5387, -112.1860],
  'gilbert': [33.3528, -111.7890],
  'tempe': [33.4255, -111.9400],
  'peoria': [33.5806, -112.2374],
  'surprise': [33.6292, -112.3680],
  'goodyear': [33.4353, -112.3577],
  'buckeye': [33.3703, -112.5838],
  'avondale': [33.4356, -112.3496],
  'flagstaff': [35.1983, -111.6513],
  'yuma': [32.6927, -114.6277],
  'casa grande': [32.8795, -111.7574],
  'queen creek': [33.2487, -111.6343],
  'maricopa': [33.0581, -112.0476],
  'prescott': [34.5400, -112.4685],
  'prescott valley': [34.6100, -112.3157],
  'sierra vista': [31.5455, -110.2773],
  'kingman': [35.1894, -114.0530],
  'lake havasu city': [34.4839, -114.3225],
  'bullhead city': [35.1478, -114.5683],
  'marana': [32.4367, -111.2255],
  'oro valley': [32.3909, -110.9665],
  'apache junction': [33.4151, -111.5496],
  'sahuarita': [31.9576, -110.9556],
  'green valley': [31.8543, -110.9937],
  'el mirage': [33.6131, -112.3246],
  'fountain hills': [33.6117, -111.7174],
  'paradise valley': [33.5312, -111.9426],
  'litchfield park': [33.4934, -112.3577],
  'tolleson': [33.4501, -112.2593],
  'san tan valley': [33.1917, -111.5250],
  'anthem': [33.8672, -112.1477],
  'payson': [34.2309, -111.3251],
  'show low': [34.2542, -110.0298],
  'safford': [32.8340, -109.7076],
  'nogales': [31.3404, -110.9343],
  'rio rico': [31.4740, -110.9787],
  'douglas': [31.3445, -109.5453],
  'bisbee': [31.4482, -109.9284],
  'benson': [31.9679, -110.2945],
  'willcox': [32.2529, -109.8318],
  'page': [36.9147, -111.4558],
  'sedona': [34.8697, -111.7610],
  'cottonwood': [34.7392, -112.0099],
  'camp verde': [34.5636, -111.8543],
  'winslow': [35.0242, -110.6974],
  'globe': [33.3942, -110.7865],
  'coolidge': [32.9779, -111.5176],
  'eloy': [32.7559, -111.5548],
  'wickenburg': [33.9686, -112.7296],
  'san luis': [32.4870, -114.7822],
  'somerton': [32.5965, -114.7096],
  'tuba city': [36.1300, -111.2400],
  'chinle': [36.1547, -109.5487],
}

/**
 * The location columns are dirty. Every shape below is in the live data today,
 * and each one splits one real place into two rows on a count:
 *   "Phoenix, AZ"   — the state repeated inside the city field.
 *   "SCOTTSDALE"    — the same city in a different case.
 *   "Arizona"       — a state NAME in the state field, beside rows using "AZ".
 *   "Arizona"       — a state name sitting in the CITY field. Not a city.
 *   "" / null       — no location at all.
 * These normalise for display and counting. They do not write to the database:
 * the rows themselves still need an admin to fix them, and the report says so.
 */
const NOT_A_CITY = new Set(['arizona', 'az', 'usa', 'united states', 'n/a', 'none', '-', 'remote'])

const STATE_CODES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
}

// "SCOTTSDALE" and "Scottsdale" are the same city and must count as one. Only
// an already-shouting or already-quiet name is re-cased, so "McDowell" and
// "DeSoto" keep the capitals their own residents use.
function titleCase(name) {
  const needsFixing = name === name.toUpperCase() || name === name.toLowerCase()
  if (!needsFixing) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s\-/'])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase())
}

export function normalizeCity(city) {
  if (!city) return ''
  let out = String(city).trim()
  // Drop a trailing ", XX" or ", Arizona" so "Phoenix, AZ" folds into "Phoenix".
  out = out.replace(/\s*,\s*(?:[A-Za-z]{2}|[A-Za-z]{4,})\s*$/i, '').trim()
  out = out.replace(/\s+/g, ' ')
  if (!out || NOT_A_CITY.has(out.toLowerCase())) return ''
  return titleCase(out)
}

/**
 * Never truncate: slicing "Arizona" to two characters produces "AR", which is
 * Arkansas, and that is exactly how Scottsdale ended up in two states at once.
 * A full name is looked up; anything else is passed through uppercased.
 */
export function normalizeState(state) {
  if (!state) return ''
  const raw = String(state).trim()
  if (!raw) return ''
  if (raw.length === 2) return raw.toUpperCase()
  return STATE_CODES[raw.toLowerCase()] || raw.toUpperCase()
}

/**
 * "Phoenix, AZ" — the one label used everywhere a location is printed.
 *
 * A record with a state but no city is NOT a location: it cannot be placed on a
 * map, it cannot be told apart from the 33 other Arizona rows, and offering
 * "AZ" as a filter option next to "Phoenix, AZ" reads as a bug. Those records
 * are counted honestly as having no location.
 */
export function locationLabel(city, state) {
  const c = normalizeCity(city)
  if (!c) return ''
  const s = normalizeState(state)
  return s ? `${c}, ${s}` : c
}

/** Canvas point for a city name, or null when we have no coordinate for it. */
export function cityPoint(city, state) {
  if (normalizeState(state) !== 'AZ') return null
  const key = normalizeCity(city).toLowerCase()
  const ll = AZ_CITIES[key]
  if (!ll) return null
  return projectToCanvas(ll[0], ll[1])
}

export default { AZ_CITIES, projectToCanvas, cityPoint, normalizeCity, normalizeState, locationLabel }
