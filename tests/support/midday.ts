/**
 * A Soundboard `hour` pinned to noon, outside the default quiet hours (22:00 to 07:00). A test that leaves
 * `hour` to the real clock goes silent whenever it happens to run at night, as CI did at 04:50 UTC.
 */
export const MIDDAY = (): number => 12;
