import { expect, it } from 'vitest'
import { matchesDirection, variantEntries } from './matching'
import {
    morningVariant,
    normalVariant,
    timetableFixture,
    variantRoute,
    variantStops,
} from './fixtures'

it('preserves operator route IDs, directions, services and original sequences', () => {
    const entries = variantEntries(morningVariant, timetableFixture(), [variantRoute], variantStops)
    expect(entries.map((e) => e.api?.seq)).toEqual([1, 2, 3, 5])
    expect(entries[3].api?.route).toBe(variantRoute)
    expect(matchesDirection(entries, variantRoute)).toBe(true)
    expect(entries.some((e) => e.api?.stop.id === 'CTB:000004')).toBe(false)
})
it('rejects distant, ambiguous and repeated operator visits while keeping the TD stop visible', () => {
    const catalog = timetableFixture()
    catalog.stops['3'] = { ...catalog.stops['3'], lat: 23 }
    const ambiguous = { ...variantStops['CTB:000002'], id: 'CTB:999999', code: '999999' }
    const route = {
        ...variantRoute,
        stops: [...variantRoute.stops, { id: ambiguous.id, seq: 7 }, { id: 'CTB:000005', seq: 8 }],
    }
    const entries = variantEntries(morningVariant, catalog, [route], {
        ...variantStops,
        [ambiguous.id]: ambiguous,
    })
    expect(entries).toHaveLength(4)
    expect(entries.slice(1).every((e) => !e.api)).toBe(true)
    expect(matchesDirection(entries, route)).toBe(false)
})
it('never maps by TD direction codes or route number alone', () => {
    const other = {
        ...variantRoute,
        id: 'CTB:720:I:1',
        bound: 'I' as const,
        stops: [...variantRoute.stops].reverse().map((s, i) => ({ ...s, seq: i + 1 })),
    }
    const entries = variantEntries(normalVariant, timetableFixture(), [other], variantStops)
    expect(matchesDirection(entries, other)).toBe(false)
    expect(
        variantEntries(
            normalVariant,
            timetableFixture(),
            [{ ...variantRoute, number: '2X' }],
            variantStops,
        ).every((e) => !e.api),
    ).toBe(true)
})

it('does not resolve a repeated visit by falling back to the opposite direction', () => {
    const repeated = {
        ...variantRoute,
        stops: [...variantRoute.stops, { id: 'CTB:000005', seq: 7 }],
    }
    const opposite = {
        ...variantRoute,
        id: 'CTB:720:I:1',
        bound: 'I' as const,
        stops: [{ id: 'CTB:000005', seq: 1 }],
    }
    const entries = variantEntries(
        morningVariant,
        timetableFixture(),
        [repeated, opposite],
        variantStops,
    )
    expect(entries.at(-1)?.api).toBeUndefined()
})

it('rejects an isolated opposite-direction match between ordered stops on the selected journey', () => {
    const primary = {
        ...variantRoute,
        stops: variantRoute.stops.filter((s) => s.id !== 'CTB:000003'),
    }
    const opposite = {
        ...variantRoute,
        id: 'CTB:720:I:1',
        bound: 'I' as const,
        stops: [{ id: 'CTB:000003', seq: 1 }],
    }
    const entries = variantEntries(
        morningVariant,
        timetableFixture(),
        [primary, opposite],
        variantStops,
    )
    expect(entries[2].api).toBeUndefined()
})
