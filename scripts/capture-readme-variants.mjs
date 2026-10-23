// Retain the normalized 8P timetable subset used by documentation captures.
import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

const sources = [
    'https://static.data.gov.hk/td/pt-headway-en/gtfs.zip',
    'https://static.data.gov.hk/td/pt-headway-tc/routes.txt',
    'https://static.data.gov.hk/td/pt-headway-tc/stops.txt',
]
const responses = await Promise.all(
    sources.map(async (url) => {
        const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
        return {
            url,
            capturedAt: new Date().toISOString(),
            lastModified: response.headers.get('last-modified'),
            bytes: new Uint8Array(await response.arrayBuffer()),
        }
    }),
)
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
    const { parseGtfs } = await server.ssrLoadModule('/src/services/variants/gtfs.ts')
    const { cachedVariantCatalog } = await server.ssrLoadModule('/src/services/variants/catalog.ts')
    const decoder = new TextDecoder()
    const full = parseGtfs(
        responses[0].bytes,
        decoder.decode(responses[1].bytes),
        decoder.decode(responses[2].bytes),
    )
    const variants = full.variants.filter((variant) => variant.number === '8P')
    const stopIds = new Set(variants.flatMap((variant) => variant.stops))
    const calendarIds = new Set(
        variants.flatMap((variant) => variant.departures.map((departure) => departure.calendar)),
    )
    const catalog = cachedVariantCatalog({
        ...full,
        variants,
        stops: Object.fromEntries(Object.entries(full.stops).filter(([id]) => stopIds.has(id))),
        calendars: Object.fromEntries(
            Object.entries(full.calendars).filter(([id]) => calendarIds.has(id)),
        ),
    })
    if (!catalog) throw new Error('Invalid captured 8P timetable')
    await writeFile(
        'scripts/fixtures/readme-variants.json',
        JSON.stringify(
            {
                capturedAt: new Date().toISOString(),
                sources: responses.map(({ url, capturedAt, lastModified }) => ({
                    url,
                    capturedAt,
                    lastModified,
                })),
                catalog,
            },
            null,
            4,
        ) + '\n',
    )
    console.log(`Captured ${variants.length} published 8P timetable patterns`)
} finally {
    await server.close()
}
