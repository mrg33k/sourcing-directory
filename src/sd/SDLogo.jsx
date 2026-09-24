// Sourcing Directory logo — red hexagon "S" mark + two-line wordmark.
// Mark geometry traced from the 2026-09-24 brand board and squared up.
// Swap for the official vector when the brand files arrive.

import React from 'react';

export const SD_MARK_PATH =
  'M22 0 L78 0 L100 38 L78 76 L22 76 L0 38 Z ' +
  'M30 11.3 L76 11 L88.5 31.7 L82 41.8 L70 22.1 L36 22.5 L41.6 32.3 L64 32.6 L76.2 53.3 L69.7 65.1 ' +
  'L22 64.8 L11.3 45.4 L16.6 36.5 L28.2 54.4 L61.3 53.9 L55.2 44.4 L33.7 43.8 L22.8 24.6 Z';

export function SDMark({ size = 40, color = 'var(--sd-red)', title }) {
  return (
    <svg width={size} height={(size * 76) / 100} viewBox="0 0 100 76" role={title ? 'img' : undefined}
      aria-label={title} aria-hidden={title ? undefined : true} style={{ display: 'block', flexShrink: 0 }}>
      <path fill={color} fillRule="evenodd" d={SD_MARK_PATH} />
    </svg>
  );
}

export default function SDLogo({ size = 'md', mono = false }) {
  const s = { sm: [44, 17], md: [60, 23], lg: [96, 38] }[size] || [44, 18];
  return (
    <span className="sd-logo" aria-label="Sourcing Directory">
      <SDMark size={s[0]} color={mono ? '#fff' : 'var(--sd-red)'} />
      <span className="sd-logo__word" style={{ fontSize: s[1] }}>
        <span>SOURCING</span>
        <span>DIRECTORY</span>
      </span>
    </span>
  );
}
