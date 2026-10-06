import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadCitybus } from '../src/services/catalog/citybus'
import { validateCitybusSnapshot, validateManifest } from '../src/services/catalog/citybusSnapshot'
import type { Payload } from '../src/services/catalog/shared'
import { makeSnapshot } from '../src/utils/transit'
import { WEEK } from '../src/types/transit'

const upstream = 'https://rt.data.gov.hk/v2/transport/citybus'
const checkpointDir = '.citybus-checkpoints'
const outputDir = '.citybus-public'
const stagingDir = '.citybus-staging'
const startedAt = Date.now()
await mkdir(checkpointDir, { recursive: true })
// Reuse successful requests only within this interrupted generation, never across weekly crawls.
let generation: number
try {
    generation = Number(await readFile(join(checkpointDir, 'generation'), 'utf8'))
    if (!Number.isSafeInteger(generation) || startedAt - generation >= 24 * 60 * 60 * 1000)
        throw new Error('Expired generation')
} catch {
    await rm(checkpointDir, { recursive: true, force: true })
    await mkdir(checkpointDir, { recursive: true })
    generation = startedAt
    await writeFile(join(checkpointDir, 'generation'), String(generation))
}
let completed = 0

async function get(path: string): Promise<Payload> {
    const key = createHash('sha256').update(path).digest('hex')
    const file = join(checkpointDir, `${key}.json`)
    try {
        return JSON.parse(await readFile(file, 'utf8')) as Payload
    } catch {
        /* Missing or corrupt checkpoints are fetched again. */
    }
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await fetch(`${upstream}${path}`, {
                signal: AbortSignal.timeout(30000),
            })
            if (!response.ok) {
                if (response.status === 429 || response.status >= 500) {
                    const header = response.headers.get('Retry-After')
                    const seconds = Number(header)
                    const delay =
                        header && Number.isFinite(seconds)
                            ? seconds * 1000
                            : header
                                ? Date.parse(header) - Date.now()
                                : 0
                    await new Promise((resolve) =>
                        setTimeout(
                            resolve,
                            Math.min(60000, Math.max(1000 * 2 ** attempt, delay || 0)),
                        ),
                    )
                }
                throw new Error(`Citybus HTTP ${response.status}: ${path}`)
            }
            const payload = await response.json()
            await writeFile(`${file}.tmp`, JSON.stringify(payload))
            await rename(`${file}.tmp`, file)
            if (++completed % 100 === 0) console.log(`Fetched ${completed} Citybus responses`)
            return payload as Payload
        } catch (error) {
            if (attempt === 4) throw error
            await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
        }
    }
    throw new Error('Citybus fetch failed')
}

const { routes, stops } = await downloadCitybus({
    get, addTotal: () => {
    }
}, async () => {
})
const updatedAt = generation
const snapshot = validateCitybusSnapshot(
    {
        ...makeSnapshot('CTB', routes, stops),
        schemaVersion: 1,
        updatedAt,
    },
    updatedAt,
)
if (Date.now() - updatedAt >= WEEK) throw new Error('Collection took too long')
const body = JSON.stringify({ ...snapshot, schemaVersion: 1 })
const sha256 = createHash('sha256').update(body).digest('hex')
const manifest = validateManifest({
    schemaVersion: 1,
    updatedAt,
    file: `snapshot-${sha256}.json`,
    sha256,
    bytes: Buffer.byteLength(body),
})
await rm(stagingDir, { recursive: true, force: true })
await mkdir(stagingDir, { recursive: true })
await writeFile(join(stagingDir, manifest.file), body)
await writeFile(join(stagingDir, 'manifest.json'), JSON.stringify(manifest))
await writeFile(
    join(stagingDir, '_headers'),
    `/*
  Access-Control-Allow-Origin: *
  X-Content-Type-Options: nosniff
  Cache-Control: public, max-age=0, must-revalidate
/snapshot-*.json
  Cache-Control: public, max-age=31536000, immutable
`,
)
// Retain the previous generation for clients that read its manifest during deployment.
const previousUrl = process.env.CITYBUS_PREVIOUS_MANIFEST_URL
if (previousUrl) {
    const response = await fetch(previousUrl, {
        signal: AbortSignal.timeout(30000),
        cache: 'no-store',
    })
    if (response.status !== 404) {
        if (!response.ok) throw new Error('Cannot read previous manifest; refusing deployment')
        const previous = validateManifest(await response.json())
        if (previous.updatedAt > updatedAt) throw new Error('Refusing older generation')
        const payload = await fetch(new URL(previous.file, previousUrl), {
            signal: AbortSignal.timeout(30000),
        })
        if (!payload.ok) throw new Error('Cannot retain previous snapshot')
        const bytes = Buffer.from(await payload.arrayBuffer())
        if (
            bytes.byteLength !== previous.bytes ||
            createHash('sha256').update(bytes).digest('hex') !== previous.sha256
        )
            throw new Error('Previous snapshot checksum mismatch')
        await writeFile(join(stagingDir, previous.file), bytes)
    }
}
await rm(outputDir, { recursive: true, force: true })
await rename(stagingDir, outputDir)
await rm(checkpointDir, { recursive: true, force: true })
console.log(
    `Citybus snapshot ready: ${routes.length} candidate directions, ${Object.keys(stops).length} stops, ${manifest.bytes} bytes`,
)
