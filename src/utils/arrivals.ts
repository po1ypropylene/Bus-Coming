import type { Arrival } from '../types/transit'

// Operator response order can group rush-hour variants rather than arrival times.
// Sort before limiting the display so the earliest bus is never truncated away.
export function upcomingArrivals(arrivals: Arrival[]): Arrival[] {
    // A past prediction can still describe an approaching bus. Let the operator
    // remove it on refresh; request failures are handled by the panel's stale state.
    return [...arrivals].sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity)).slice(0, 3)
}
