import { expect, it } from 'vitest'
import { defaultVariant, nextDeparture } from './schedule'
import { morningVariant, normalVariant, timetableFixture } from './fixtures'

const hk = (value: string) => Date.parse(`${value}+08:00`)
it('defaults to an active morning variant and then the normal service', () => {
    const catalog = timetableFixture()
    expect(defaultVariant(catalog.variants, catalog, hk('2026-10-20T08:00:00'))).toBe(
        morningVariant.id,
    )
    expect(defaultVariant(catalog.variants, catalog, hk('2026-10-20T09:00:00'))).toBe(
        normalVariant.id,
    )
    expect(defaultVariant(catalog.variants, catalog, hk('2026-10-20T08:59:59'))).toBe(
        normalVariant.id,
    )
})
it('selects the earliest when services overlap and the next scheduled service when none is within an hour', () => {
    const catalog = timetableFixture()
    const fixed = {
        ...morningVariant,
        departures: [{ calendar: 'daily', start: 9 * 3600 + 60, end: 9 * 3600 + 60, headway: 0 }],
    }
    expect(defaultVariant([fixed, normalVariant], catalog, hk('2026-10-20T08:00:00'))).toBe(
        normalVariant.id,
    )
    expect(defaultVariant([fixed], catalog, hk('2026-10-20T01:00:00'))).toBe(fixed.id)
    expect(nextDeparture(fixed, catalog, hk('2026-10-20T09:01:00'))).toBe(hk('2026-10-20T09:01:00'))
})
it('honours weekdays, holiday removals and additions independently of device timezone', () => {
    const catalog = timetableFixture()
    catalog.calendars.weekday.exceptions['20261020'] = false
    catalog.calendars.weekday.exceptions['20261024'] = true
    expect(defaultVariant(catalog.variants, catalog, hk('2026-10-20T07:00:00'))).toBe(
        normalVariant.id,
    )
    expect(nextDeparture(morningVariant, catalog, hk('2026-10-24T07:01:00'))).toBe(
        hk('2026-10-24T07:10:00'),
    )
    expect(nextDeparture(morningVariant, catalog, hk('2026-10-25T07:00:00'))).toBe(
        hk('2026-10-26T07:00:00'),
    )
})
it('handles departures after midnight on the previous service day and exclusive frequency ends', () => {
    const catalog = timetableFixture()
    const late = {
        ...morningVariant,
        departures: [{ calendar: 'weekday', start: 24 * 3600, end: 25 * 3600, headway: 600 }],
    }
    expect(nextDeparture(late, catalog, hk('2026-10-24T00:05:00'))).toBe(hk('2026-10-24T00:10:00'))
    expect(nextDeparture(late, catalog, hk('2026-10-24T01:00:00'))).toBe(hk('2026-10-27T00:00:00'))
})
it('returns no selection for expired calendars or no variants', () => {
    const catalog = timetableFixture()
    catalog.calendars.weekday.end = '20200101'
    expect(nextDeparture(morningVariant, catalog, hk('2026-10-20T07:00:00'))).toBeNull()
    expect(defaultVariant([], catalog, Date.now())).toBeNull()
})
