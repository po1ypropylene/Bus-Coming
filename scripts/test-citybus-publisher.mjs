import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const executable = resolve('.catalog-tools/generate-citybus.mjs')
const directory = await mkdtemp(join(tmpdir(), 'bus-citybus-publisher-'))
try {
    const loader = join(directory, 'fixture.mjs')
    await writeFile(
        loader,
        `
import { readFile } from 'node:fs/promises'
const calls = []
globalThis.fetch = async (url) => {
    calls.push(String(url))
    const parsed = new URL(url)
    const path = parsed.pathname
    if (parsed.hostname === 'previous.example') {
        if (process.env.BAD_PREVIOUS) return new Response('Unavailable', { status: 503 })
        return new Response(await readFile('.previous' + (path.endsWith('manifest.json') ? '-manifest' : '-snapshot')))
    }
    if (path.endsWith('/route/CTB')) return Response.json({ data: [{ route: '2X', orig_en: 'A', orig_tc: '甲', dest_en: 'B', dest_tc: '乙' }] })
    if (path.endsWith('/outbound')) return Response.json({ data: [] })
    if (path.endsWith('/inbound')) return Response.json({ data: [{ stop: '001234', seq: 1 }, { stop: '001234', seq: 3 }] })
    if (path.endsWith('/stop/001234')) return Response.json({ data: { stop: '001234', name_en: 'Stop', name_tc: '站', lat: process.env.BAD_STOP ? 'invalid' : 22.3, long: 114.2 } })
    throw new Error('Unexpected fixture URL: ' + url)
}
process.on('exit', () => {
    if (calls.filter((url) => url.endsWith('/stop/001234')).length !== 1 && !process.env.BAD_STOP) process.exitCode = 1
})
`,
    )
    const run = (extra = {}) =>
        execFileSync(process.execPath, ['--import', loader, executable], {
            cwd: directory,
            env: { ...process.env, CITYBUS_PREVIOUS_MANIFEST_URL: '', ...extra },
            stdio: 'pipe',
        })
    run()
    const output = join(directory, '.citybus-public')
    const manifestText = await readFile(join(output, 'manifest.json'), 'utf8')
    const manifest = JSON.parse(manifestText)
    const bytes = await readFile(join(output, manifest.file))
    assert.equal(bytes.length, manifest.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256)
    const snapshot = JSON.parse(bytes)
    assert.equal(snapshot.routes.length, 1)
    assert.equal(snapshot.routes[0].bound, 'I')
    assert.equal(snapshot.stops['CTB:001234'].code, '001234')
    assert.equal(snapshot.stopRoutes['CTB:001234'].length, 2)
    assert.match(
        await readFile(join(output, '_headers'), 'utf8'),
        /Access-Control-Allow-Origin: \*/,
    )
    await writeFile(join(directory, '.previous-manifest'), manifestText)
    await writeFile(join(directory, '.previous-snapshot'), bytes)
    run({ CITYBUS_PREVIOUS_MANIFEST_URL: 'https://previous.example/manifest.json' })
    assert.deepEqual(await readFile(join(output, manifest.file)), bytes)
    const retainedManifest = await readFile(join(output, 'manifest.json'), 'utf8')
    assert.throws(() =>
        run({
            CITYBUS_PREVIOUS_MANIFEST_URL: 'https://previous.example/manifest.json',
            BAD_PREVIOUS: 'true',
        }),
    )
    assert.equal(await readFile(join(output, 'manifest.json'), 'utf8'), retainedManifest)
    // Clear fixture-only checkpoints before exercising a new invalid upstream generation.
    await rm(join(directory, '.citybus-checkpoints'), { recursive: true, force: true })
    await mkdir(join(directory, '.citybus-checkpoints'), { recursive: true })
    assert.throws(() => run({ BAD_STOP: 'true' }))
    assert.equal(await readFile(join(output, 'manifest.json'), 'utf8'), retainedManifest)
    console.log(
        'Publisher fixtures passed: normalization, deduplication, hash, headers, previous-generation retention, failed-publication preservation',
    )
} finally {
    await rm(directory, { recursive: true, force: true })
}
