// Read-only targeted audit: node scripts/audit-citybus-route.mjs N8P
import { writeFile } from 'node:fs/promises'
const route = process.argv[2] ?? 'N8P'
if (!/^[A-Z0-9]+$/.test(route)) throw new Error('Expected a route number')
const base = 'https://rt.data.gov.hk/v2/transport/citybus'
async function get(path) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(25000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`)
    return response.json()
}
const evidence = {
    checkedAt: new Date().toISOString(),
    route: await get(`/route/CTB/${route}`),
    directions: [],
}
for (const direction of ['inbound', 'outbound']) {
    const stops = await get(`/route-stop/CTB/${route}/${direction}`)
    const checks = []
    // Small batches avoid flooding the public endpoint.
    for (let offset = 0; offset < stops.data.length; offset += 4) {
        checks.push(
            ...(await Promise.all(
                stops.data.slice(offset, offset + 4).map(async (stop) => {
                    const eta = await get(`/eta/CTB/${stop.stop}/${route}`)
                    const rows = eta.data.filter((row) => row.dir === stop.dir)
                    return {
                        stop: stop.stop,
                        catalogueSequence: stop.seq,
                        etaSequences: [...new Set(rows.map((row) => row.seq))],
                        strictMatches: rows.filter((row) => row.seq === stop.seq).length,
                        arrivals: rows.filter((row) => row.eta).length,
                        response: eta,
                    }
                }),
            )),
        )
    }
    evidence.directions.push({ direction, stops, checks })
    console.log(direction, JSON.stringify(checks.map(({ response, ...check }) => check)))
}
await writeFile(
    `docs/citybus-${route.toLowerCase()}-audit.json`,
    JSON.stringify(evidence, null, 4) + '\n',
)
