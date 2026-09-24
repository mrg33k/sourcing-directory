// One entry per directory. Adding an industry = adding an entry here.
//
// `live`     — directory has data and opens today.
// `base`     — route the directory lives at. Aerospace keeps the existing /spaceos
//              pages; the others open the same directory filtered by `vertical`.
// `vertical` — directory_companies.vertical value(s) this directory shows.

export const INDUSTRIES = [
  {
    slug: 'manufacturing',
    name: 'Manufacturing',
    image: '/sd/manufacturing.jpg',
    wide: '/sd/manufacturing-wide.jpg',
    live: false,
  },
  {
    slug: 'aerospace',
    name: 'Aerospace',
    image: '/sd/aerospace.jpg',
    wide: '/sd/aerospace-wide.jpg',
    live: true,
    base: '/spaceos',
    vertical: ['space', 'defense'],
  },
  {
    slug: 'construction',
    name: 'Construction',
    image: '/sd/construction.jpg',
    wide: '/sd/construction-wide.jpg',
    live: false,
  },
  {
    slug: 'semiconductors',
    name: 'Semiconductors',
    image: '/sd/semiconductors.jpg',
    wide: '/sd/semiconductors-wide.jpg',
    live: true,
    base: '/spaceos',
    query: '?v=semiconductor',
    vertical: ['semiconductor'],
  },
];

export const industryBySlug = (slug) => INDUSTRIES.find((i) => i.slug === slug);

export function directoryHref(ind) {
  if (!ind?.live) return null;
  return `${ind.base}${ind.query || ''}`;
}

// ── Onboarding profile (kept on this device until accounts come back) ──
const KEY = 'sd.profile.v1';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...p, savedAt: new Date().toISOString() })); } catch { /* private mode */ }
}
