// On sourcing.directory, pages still set "Space OS | Space Rising"-style titles.
// Rewrite them in one place so every tab reads "… | Sourcing Directory".
// spacerising.org keeps its own titles.

const BRAND = 'Sourcing Directory';
const OLD = /^(space os|space rising|spaceos|sourcing\.directory|a new way to space|space rising interactive)$/i;

export function brandTitle(t) {
  const parts = String(t || '').split(/\s[|—–]\s|\|/).map((s) => s.trim()).filter(Boolean).filter((s) => !OLD.test(s) && s !== BRAND);
  return parts.length ? `${parts.join(' | ')} | ${BRAND}` : BRAND;
}

export function installBrandTitle() {
  if (typeof document === 'undefined' || /spacerising/i.test(window.location.hostname)) return;
  document.documentElement.classList.add('sd-host');
  let busy = false;
  const fix = () => {
    if (busy) return;
    const next = brandTitle(document.title);
    if (next !== document.title) { busy = true; document.title = next; busy = false; }
  };
  fix();
  const el = document.querySelector('title') || document.head.appendChild(document.createElement('title'));
  new MutationObserver(fix).observe(el, { childList: true, characterData: true, subtree: true });
}
