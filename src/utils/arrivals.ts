import type { Arrival } from '../types/transit'

// Operator response order can group rush-hour variants rather than arrival times.
// Sort before limiting the display so the earliest bus is never truncated away.
export function upcomingArrivals(arrivals: Arrival[], now: number): Arrival[] {
    return arrivals
        .filter((a) => a.time === null || a.time > now - 60000)
        .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity))
        .slice(0, 3)
}
