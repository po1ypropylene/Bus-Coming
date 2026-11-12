import { expect, it } from 'vitest'
import { stopCollector, type Row } from './shared'

const stop = { stop: '001234', name_en: 'Stop', name_tc: '車站', lat: '22.3', long: '114.2' }

it('preserves operator stop IDs and parses supplied numeric coordinates', () => {
    const collector = stopCollector('CTB')
    collector.addStop(stop)
    expect(collector.stops['CTB:001234']).toMatchObject({ code: '001234', lat: 22.3, lng: 114.2 })
})

it.each([null, undefined, '', ' ', false, 'invalid', 91, -91, Infinity])(
    'rejects missing or invalid latitude %j instead of manufacturing zero coordinates',
    (lat) => {
        const collector = stopCollector('CTB')
        expect(() => collector.addStop({ ...stop, lat } as Row)).toThrow('Invalid stop data')
        expect(collector.stops).toEqual({})
    },
)

it.each([null, '', 181, -181])('rejects missing or out-of-range longitude %j', (long) => {
    expect(() => stopCollector('CTB').addStop({ ...stop, long } as Row)).toThrow(
        'Invalid stop data',
    )
})

it.each([undefined, ''])('rejects missing stop identities %j', (code) => {
    expect(() => stopCollector('CTB').addStop({ ...stop, stop: code } as Row)).toThrow(
        'Invalid stop data',
    )
})
