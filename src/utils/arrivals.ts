import type { Copy } from '../i18n'
import type { Arrival } from '../types/transit'

// Operator response order can group rush-hour variants rather than arrival times.
// Sort before limiting the display so the earliest bus is never truncated away.
export function upcomingArrivals(arrivals: Arrival[]): Arrival[] {
    // A past prediction can still describe an approaching bus. Let the operator
    // remove it on refresh; request failures are handled by the panel's stale state.
    return [...arrivals].sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity)).slice(0, 3)
}

export function arrivalCountdown(time: number | null, now: number, t: Copy): string {
    return time === null
        ? '—'
        : time - now <= 60000
            ? t.due
            : String(Math.ceil((time - now) / 60000))
}

export function arrivalAge(fetchedAt: number, now: number, t: Copy): string {
    return t.secondsAgo.replace(
        '{seconds}',
        String(Math.max(0, Math.floor((now - fetchedAt) / 1000))),
    )
}
