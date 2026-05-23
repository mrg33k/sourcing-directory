import { useEffect } from 'react';

// Sets document.title for the SRW route while the component is mounted, and
// restores the prior title (typically "sourcing.directory") on unmount.
// Use one call per SRW page so every route advertises a Space Rising title.
export default function useSRWTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}
