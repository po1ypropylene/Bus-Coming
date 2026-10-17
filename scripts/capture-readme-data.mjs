// Targeted public operator captures for documentation only; never used by the app.
import { mkdir, writeFile } from 'node:fs/promises'

const base = {
    CTB: 'https://rt.data.gov.hk/v2/transport/citybus',
    KMB: 'https://data.etabus.gov.hk/v1/transport/kmb',
}
const responses = {}
async function get(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(url, { signal: AbortSignal.timeout(25000) })
        if (response.ok) {
            const json = await response.json()
            responses[url] = { capturedAt: new Date().toISOString(), json }
            return json.data
        }
        if (attempt === 2) throw new Error(`${response.status}: ${url}`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    }
}
const routes = []
for (const [provider, number] of [
    ['CTB', '8P'],
    ['CTB', '118'],
    ['KMB', '118'],
]) {
    for (const [bound, direction] of [
        ['O', 'outbound'],
        ['I', 'inbound'],
    ]) {
        const ctb = provider === 'CTB'
        const row = await get(
            `${base[provider]}/route/${ctb ? `CTB/${number}` : `${number}/${direction}/1`}`,
        )
        const links = await get(
            `${base[provider]}/route-stop/${ctb ? `CTB/${number}/${direction}` : `${number}/${direction}/1`}`,
        )
        const origin = ctb && bound === 'I' ? 'dest' : 'orig'
        const destination = ctb && bound === 'I' ? 'orig' : 'dest'
        routes.push({
            id: `${provider}:${number}:${bound}:1`,
            number,
            provider,
            bound,
            service: '1',
            origin: { en: row[`${origin}_en`], tc: row[`${origin}_tc`] },
            destination: { en: row[`${destination}_en`], tc: row[`${destination}_tc`] },
            stops: links.map((link) => ({ id: `${provider}:${link.stop}`, seq: Number(link.seq) })),
        })
    }
}
const ids = [...new Set(routes.flatMap((route) => route.stops.map((stop) => stop.id)))]
const stops = {}
let index = 0
await Promise.all(
    Array.from({ length: 4 }, async () => {
        while (index < ids.length) {
            const id = ids[index++]
            const [provider, code] = id.split(':')
            const row = await get(`${base[provider]}/stop/${code}`)
            stops[id] = {
                id,
                code,
                provider,
                name: { en: row.name_en, tc: row.name_tc },
                lat: Number(row.lat),
                lng: Number(row.long),
            }
        }
    }),
)
const jointUrl = new URL(
    'https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/FeatureServer/0/query',
)
jointUrl.search = new URLSearchParams({
    f: 'json',
    where: "ROUTE_NAMEE = '118' AND COMPANY_CODE = 'KMB+CTB'",
    outFields: 'OBJECTID,COMPANY_CODE,ROUTE_NAMEE',
    returnGeometry: 'false',
})
await get(jointUrl.href)
if (!responses[jointUrl.href].json.features?.length)
    throw new Error('No official 118 joint membership')
// Citybus 118 lists special-origin stops before the KMB origin; include its first three visits.
// Retain unmodified predictions and their source times, including any empty responses.
for (const route of routes) {
    const visits = route.stops.slice(0, route.provider === 'CTB' && route.number === '118' ? 3 : 1)
    for (const visit of visits) {
        const code = visit.id.split(':')[1]
        await get(
            `${base[route.provider]}/eta/${route.provider === 'CTB' ? `CTB/${code}/${route.number}` : `${code}/${route.number}/1`}`,
        )
    }
}
const capturedAt = new Date().toISOString()
await mkdir('scripts/fixtures', { recursive: true })
await writeFile(
    'scripts/fixtures/readme-transit.json',
    JSON.stringify({ capturedAt, routes, stops, responses }, null, 4) + '\n',
)
console.log(
    `Captured ${routes.length} route directions, ${ids.length} stops and origin ETAs at ${capturedAt}`,
)
