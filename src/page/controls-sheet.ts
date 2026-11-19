/**
 * Keeps the page's controls (pause, sound, music, theme) in the header and moves them into the
 * controls sheet while the viewport is compact, following the media query live so a rotation or
 * resize never strands them in a hidden container.
 */
export function placeControls(
  query: MediaQueryList,
  header: HTMLElement,
  sheetBody: HTMLElement,
  controls: readonly HTMLElement[],
  onLeaveCompact: () => void,
): void {
  const place = (): void => {
    (query.matches ? sheetBody : header).append(...controls);
  };
  place();
  query.addEventListener('change', () => {
    place();
    if (!query.matches) onLeaveCompact();
  });
}
