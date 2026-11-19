/** The width at or below which the page switches to its compact (phone) mode. CSS uses the same query. */
export const COMPACT_QUERY = '(max-width: 480px)';

/** Live: a rotation or resize can cross the breakpoint, so behaviour (tap to inspect, no hover tooltip) reads `matches` each time. */
export const compactMedia: MediaQueryList = window.matchMedia(COMPACT_QUERY);

export const isCompact = (): boolean => compactMedia.matches;
