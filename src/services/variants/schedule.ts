import type { RouteVariant, ServiceCalendar, VariantCatalog } from './types'

const DAY = 86400000
const HOUR = 3600000

function operating(calendar: ServiceCalendar, midnight: number) {
    const date = new Date(midnight + 8 * HOUR)
    const key = date.toISOString().slice(0, 10).replaceAll('-', '')
    return (
        calendar.exceptions[key] ??
        (key >= calendar.start && key <= calendar.end && calendar.days.includes(date.getUTCDay()))
    )
}

export function nextDeparture(
    variant: RouteVariant,
    catalog: VariantCatalog,
    now: number,
): number | null {
    const local = new Date(now + 8 * HOUR)
    const today =
        Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 8 * HOUR
    let next = Infinity
    // Previous service day covers GTFS times after 24:00. Calendar exceptions
    // must also be applied when looking past a weekend or a holiday.
    for (let day = -1; day <= 14; day++) {
        const midnight = today + day * DAY
        for (const period of variant.departures) {
            const calendar = catalog.calendars[period.calendar]
            if (!calendar || !operating(calendar, midnight)) continue
            const start = midnight + period.start * 1000
            const end = midnight + period.end * 1000
            const candidate =
                period.headway > 0
                    ? start +
                      Math.max(0, Math.ceil((now - start) / (period.headway * 1000))) *
                          period.headway *
                          1000
                    : start
            // GTFS frequency end_time is exclusive; fixed departures have start=end.
            if (candidate >= now && (period.headway ? candidate < end : candidate === end))
                next = Math.min(next, candidate)
        }
        if (next < today + (day + 1) * DAY) break
    }
    return Number.isFinite(next) ? next : null
}

export function defaultVariant(
    variants: RouteVariant[],
    catalog: VariantCatalog,
    now: number,
): string | null {
    const ranked = variants
        .map((variant) => ({ id: variant.id, next: nextDeparture(variant, catalog, now) }))
        .filter((v): v is { id: string; next: number } => v.next !== null)
        .sort((a, b) => a.next - b.next || a.id.localeCompare(b.id))
    const upcoming = ranked.filter((v) => v.next <= now + HOUR)
    return (upcoming[0] ?? ranked[0])?.id ?? null
}
