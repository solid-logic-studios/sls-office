/** The width at or below which the page switches to its compact (phone) mode. CSS uses the same query live. */
export const COMPACT_QUERY = '(max-width: 480px)';

/** Read once at load: it decides behaviour (tap to inspect, no hover tooltip), not layout. */
export const compact: boolean = window.matchMedia(COMPACT_QUERY).matches;
