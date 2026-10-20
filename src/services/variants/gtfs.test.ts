import { expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { csvRecords, parseGtfs } from './gtfs'
import { cachedVariantCatalog } from './catalog'

const routeNames =
    'route_id,agency_id,route_short_name,route_long_name\n1775,CTB,720,"Grand Promenade - Wing Wo Street, morning"\n'
const stopNames =
    'stop_id,stop_name,stop_lat,stop_lon\n1,[CTB] Origin,22.28,114.15\n2,[CTB] Wing Wo Street,22.29,114.15\n'
const chineseRoutes = 'route_id,route_long_name\n1775,嘉亨灣 - 永和街\n'
const chineseStops = 'stop_id,stop_name\n1,[CTB] 嘉亨灣\n2,[CTB] 永和街\n'
function archive(extra = '') {
    return zipSync(
        Object.fromEntries(
            Object.entries({
                'routes.txt': routeNames,
                'stops.txt': stopNames,
                'trips.txt': `route_id,service_id,trip_id\n1775,287,first\n1775,287,second\n${extra}`,
                'stop_times.txt':
                    'trip_id,stop_id,stop_sequence,departure_time\nfirst,2,2,\nfirst,1,1,07:00:00\nsecond,1,1,07:10:00\nsecond,2,2,\n',
                'frequencies.txt':
                    'trip_id,start_time,end_time,headway_secs\nfirst,07:00:00,07:10:00,600\n',
                'calendar.txt':
                    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n287,1,1,1,1,1,0,0,20200101,20991231\n',
                'calendar_dates.txt': 'service_id,date,exception_type\n287,20261020,2\n',
                'fare_rules.txt': 'unneeded fare data',
            }).map(([name, content]) => [name, strToU8(content)]),
        ),
    )
}
it('reads quoted commas, escaped quotes, CRLF, BOM and embedded newlines', () => {
    expect([...csvRecords('\uFEFFid,name\r\n1,"a,b"\r\n2,"a""b\nc"\r\n')]).toEqual([
        { id: '1', name: 'a,b' },
        { id: '2', name: 'a"b\nc' },
    ])
    expect(() => [...csvRecords('id,name\n1,"unterminated')]).toThrow()
})
it('groups identical stop patterns, preserves fixed and frequency departures, and reads bilingual labels', () => {
    const catalog = parseGtfs(archive(), chineseRoutes, chineseStops)
    expect(cachedVariantCatalog(catalog)).toBe(catalog)
    expect(catalog.variants).toHaveLength(1)
    expect(catalog.variants[0].stops).toEqual(['1', '2'])
    expect(catalog.variants[0].departures).toEqual([
        { calendar: '287', start: 25200, end: 25800, headway: 600 },
        { calendar: '287', start: 25800, end: 25800, headway: 0 },
    ])
    expect(catalog.stops['2'].name).toEqual({ en: 'Wing Wo Street', tc: '永和街' })
    expect(catalog.calendars['287'].exceptions['20261020']).toBe(false)
    expect(parseGtfs(archive(), chineseRoutes, chineseStops).variants[0].id).toBe(
        catalog.variants[0].id,
    )
})
it('rejects incomplete source data rather than publishing a partial timetable', () => {
    expect(() => parseGtfs(archive('1775,287,missing\n'), chineseRoutes, chineseStops)).toThrow(
        'Incomplete',
    )
    expect(() => parseGtfs(archive(), chineseRoutes, 'stop_id,stop_name\n')).toThrow(
        'Missing Chinese stop',
    )
})
it('rejects cached data with broken references, duplicate IDs or invalid calendars and periods', () => {
    for (const mutate of [
        (c: ReturnType<typeof parseGtfs>) => {
            delete c.stops['2']
        },
        (c: ReturnType<typeof parseGtfs>) => {
            c.variants.push(c.variants[0])
        },
        (c: ReturnType<typeof parseGtfs>) => {
            c.variants[0].departures[0].headway = -1
        },
        (c: ReturnType<typeof parseGtfs>) => {
            c.calendars['287'].days = [8]
        },
    ]) {
        const catalog = parseGtfs(archive(), chineseRoutes, chineseStops)
        mutate(catalog)
        expect(cachedVariantCatalog(catalog)).toBeNull()
    }
})
