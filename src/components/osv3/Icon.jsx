import React from 'react'

/**
 * One icon family for the profile + admin screens.
 *
 * Every glyph is a 24x24 line drawing on `currentColor`, so colour comes from
 * the CSS class on the parent (which reads a --v3-* token) and never from a
 * prop. Size comes from CSS too — `svg { width, height }` on the wrapper class
 * — so no caller ever needs an inline style.
 *
 * Unknown name -> a small ring, never a crash and never an empty box.
 */

const P = {
  // --- identity / contact -------------------------------------------------
  location: <><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.7 5.7 3.7 9s-1.2 6.3-3.7 9c-2.5-2.7-3.7-5.7-3.7-9S9.5 5.7 12 3z" /></>,
  linkedin: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10.5V17M8 7.6v.1M12 17v-3.6a2 2 0 0 1 4 0V17" /></>,
  phone: <path d="M6 3h3l1.6 4-2 1.4a12 12 0 0 0 5 5L15 11.4 19 13v3a2 2 0 0 1-2.2 2A15.6 15.6 0 0 1 4 5.2 2 2 0 0 1 6 3z" />,

  // --- state --------------------------------------------------------------
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="M8.4 12.2l2.5 2.5 4.7-4.9" /></>,
  'shield-check': <><path d="M12 3l7 3v6c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6z" /><path d="M8.8 12.1l2.2 2.2 4.2-4.4" /></>,
  shield: <path d="M12 3l7 3v6c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>,
  cross: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" /></>,

  // --- actions ------------------------------------------------------------
  send: <><path d="M21 3L10.5 13.5" /><path d="M21 3l-6.8 18-3.7-7.5L3 9.8z" /></>,
  bookmark: <path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  'arrow-right': <><path d="M4 12h15" /><path d="M13.5 6.5L19 12l-5.5 5.5" /></>,
  'arrow-up': <><path d="M12 19V5" /><path d="M6.5 10.5L12 5l5.5 5.5" /></>,
  download: <><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19h14" /></>,
  expand: <><path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14.5 5.5l4 4" /></>,
  dots: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L3.6 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z" /></>,
  megaphone: <><path d="M4 10v4a1 1 0 0 0 1 1h2l8 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M18 9.5a3.5 3.5 0 0 1 0 5" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9z" /><path d="M10.2 18a2 2 0 0 0 3.6 0" /></>,

  // --- entities -----------------------------------------------------------
  users: <><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6S14 16 14.5 19" /><path d="M16 7.2a3 3 0 0 1 0 5.6M17.5 19c-.2-1.4-.7-2.6-1.5-3.5" /></>,
  building: <><rect x="4" y="4" width="10" height="16" rx="1" /><path d="M14 10h5a1 1 0 0 1 1 1v9" /><path d="M7 8h4M7 12h4M7 16h4M17 14h1M17 17h1" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3 12h18" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></>,
  eye: <><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.6" /></>,
  graduation: <><path d="M12 5l9 4-9 4-9-4z" /><path d="M6.5 11v4.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V11" /></>,
  bank: <><path d="M4 10h16M12 3.5L20.5 8h-17z" /><path d="M7 10v7M11 10v7M15 10v7M19 10v7M3.5 20.5h17" /></>,
  investor: <><circle cx="12" cy="9" r="3.2" /><path d="M12 12.2v0" /><path d="M5.5 20c.6-3.2 3.2-5 6.5-5s5.9 1.8 6.5 5" /><path d="M12 6.6v4.8M10.6 7.6h2.4M11 9.6h2.2" /></>,
  truck: <><rect x="2.5" y="7" width="11" height="9" rx="1" /><path d="M13.5 10h3.6l3.4 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  handshake: <><path d="M3 11l3-3 3.5 1.5L12 8l2.5 1.5L18 8l3 3" /><path d="M6 8v7.5M18 8v7.5" /><path d="M9 12.5l2.2 2.2a1.6 1.6 0 0 0 2.3 0l2-2" /></>,
  file: <><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /></>,
  'user-plus': <><circle cx="10" cy="9" r="3.2" /><path d="M4 19c.6-3 2.9-4.6 6-4.6 1.2 0 2.3.2 3.2.7" /><path d="M17.5 14.5v5M15 17h5" /></>,
  'org-check': <><rect x="4" y="5" width="11" height="15" rx="1" /><path d="M7 9h5M7 13h5" /><path d="M14.5 16.6l2 2 4-4.2" /></>,
  rocket: <><path d="M12 3c3 2.2 4.6 5.3 4.6 9.2L14 15h-4l-2.6-2.8C7.4 8.3 9 5.2 12 3z" /><circle cx="12" cy="9.4" r="1.6" /><path d="M10 15l-2.5 4 3.2-1.1M14 15l2.5 4-3.2-1.1" /></>,
  satellite: <><rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)" /><path d="M4.5 8.5l3-3 3 3-3 3zM16.5 12.5l3 3-3 3-3-3z" /><path d="M14 6.5a4 4 0 0 1 3.5 3.5" /></>,
  chip: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3" /></>,
  gauge: <><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-4.5" /><circle cx="12" cy="16" r="1.2" /></>,
  layers: <><path d="M12 4l8 4-8 4-8-4z" /><path d="M4.5 12L12 15.7 19.5 12" /><path d="M4.5 16L12 19.7 19.5 16" /></>,
  signal: <><path d="M12 20V9" /><path d="M8 20v-6M16 20v-6" /><path d="M6.5 6.5a7.8 7.8 0 0 1 11 0" /><path d="M9 9.2a4.2 4.2 0 0 1 6 0" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,

  // --- the six space missions (badge glyphs, as drawn in the reference) ----
  'mission-build': <><circle cx="12" cy="12" r="9" /><path d="M8.5 15.5V11l3.5-2.6 3.5 2.6v4.5z" /><path d="M11 15.5v-2.4h2v2.4" /></>,
  'mission-operate': <><circle cx="12" cy="12" r="9" /><path d="M8.4 13.6l3.6-3.6 3.6 3.6" /><circle cx="12" cy="15.2" r="1" /></>,
  'mission-prosper': <><circle cx="12" cy="12" r="9" /><path d="M12 7.6v8.8" /><path d="M14.2 9.4c0-.9-1-1.5-2.2-1.5s-2.2.6-2.2 1.5.9 1.4 2.2 1.7 2.2.8 2.2 1.8-1 1.6-2.2 1.6-2.2-.7-2.2-1.6" /></>,
  'mission-live': <><circle cx="12" cy="12" r="9" /><path d="M8 12.4L12 9l4 3.4V16H8z" /><path d="M10.8 16v-2.3h2.4V16" /></>,
  'mission-move': <><circle cx="12" cy="12" r="9" /><path d="M8 15.4l3.2-6.6 3.2 6.6" /><path d="M9.6 13.8h4.8" /></>,
  'mission-secure': <><circle cx="12" cy="12" r="9" /><path d="M12 7.6l3.4 1.4v2.8c0 2-1.4 3.6-3.4 4.2-2-.6-3.4-2.2-3.4-4.2V9z" /></>,
}

const FALLBACK = <circle cx="12" cy="12" r="6.5" />

export default function Icon({ name, title }) {
  const body = P[name] || FALLBACK
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  )
}

export const ICON_NAMES = Object.keys(P)
