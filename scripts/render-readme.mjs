// Real Safari captures with dated operator responses and an illustrative device frame.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import sharp from 'sharp'

const fixture = JSON.parse(await readFile('scripts/fixtures/readme-transit.json', 'utf8'))
const variants = JSON.parse(await readFile('scripts/fixtures/readme-variants.json', 'utf8'))
const origin = process.env.README_BASE_URL ?? 'http://127.0.0.1:4174'
const driver = process.env.SAFARI_DRIVER_URL ?? 'http://127.0.0.1:4444'
const templateDirectory = new URL('./templates/iphone/', import.meta.url)
const frameTemplate = await readFile(new URL('frame.html', templateDirectory), 'utf8')
const statusCss = await readFile(new URL('status-bar.css', templateDirectory), 'utf8')
const bezel = await readFile(new URL('bezel.png', templateDirectory))
const status = await readFile(new URL('ios-status-icons.svg', templateDirectory))
const snapshots = ['KMB', 'CTB', 'NLB'].map((provider) => {
    const routes = fixture.routes.filter((route) => route.provider === provider)
    const stops = Object.fromEntries(
        Object.entries(fixture.stops).filter(([, stop]) => stop.provider === provider),
    )
    const stopRoutes = {}
    for (const route of routes)
        for (const stop of route.stops)
            (stopRoutes[stop.id] ??= []).push({ routeId: route.id, seq: stop.seq })
    return { provider, updatedAt: Date.parse(fixture.capturedAt), routes, stops, stopRoutes }
})
const bookmarks = ['CTB:8P:O:1', 'KMB:118:I:1'].map((id) => {
    const route = fixture.routes.find((candidate) => candidate.id === id)
    const visit = route.stops[0]
    return {
        id: `${id}:${visit.id}:${visit.seq}`,
        routeId: id,
        stopId: visit.id,
        seq: visit.seq,
        group: '日常路線',
        route,
        stop: fixture.stops[visit.id],
    }
})

// Runs only in Safari's isolated automation session on a temporary loopback origin.
function installReplay(fixture) {
    const RealDate = Date
    globalThis.Date = class extends RealDate {
        constructor(...args) {
            super(...(args.length ? args : [fixture.capturedAt]))
        }
        static now() {
            return RealDate.parse(fixture.capturedAt)
        }
    }
    const nativeFetch = globalThis.fetch.bind(globalThis)
    globalThis.captureErrors = []
    globalThis.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.url
        if (!/^https?:/.test(url) || new URL(url).origin === location.origin)
            return nativeFetch(input, init)
        const captured =
            fixture.responses[url] ??
            (url.includes('portal.csdi.gov.hk')
                ? Object.entries(fixture.responses).find(([key]) =>
                      key.includes('portal.csdi.gov.hk'),
                  )?.[1]
                : undefined)
        if (!captured) {
            globalThis.captureErrors.push(url)
            if (typeof document === 'undefined') postMessage({ type: 'captureError', url })
            return Promise.reject(new Error(`Uncaptured API requested: ${url}`))
        }
        return Promise.resolve(Response.json(captured.json))
    }
}
async function bootstrap({ fixture, variants, snapshots, bookmarks, scheme }) {
    installReplay(fixture)
    const nativeMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
        const result = nativeMatchMedia(query)
        if (query.includes('prefers-color-scheme'))
            Object.defineProperty(result, 'matches', {
                value: query.includes(scheme),
            })
        return result
    }
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
        constructor(...args) {
            super(...args)
            this.addEventListener('message', ({ data }) => {
                if (data.type === 'captureError') window.captureErrors.push(data.url)
                if (data.type === 'complete') window.captureWorkerReady = true
            })
        }
    }
    localStorage.setItem(
        'bus-coming-user-v1',
        JSON.stringify({ version: 1, language: 'tc', theme: 'blue', bookmarks }),
    )
    await new Promise((resolve, reject) => {
        const request = indexedDB.open('bus-coming-v1', 2)
        request.onupgradeneeded = () => {
            for (const name of ['snapshots', 'routeCatalogs'])
                request.result.createObjectStore(name, { keyPath: 'provider' })
            request.result.createObjectStore('routeDetails', { keyPath: 'id' })
            for (const name of ['responses', 'generations']) request.result.createObjectStore(name)
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
            const transaction = request.result.transaction(['snapshots', 'responses'], 'readwrite')
            snapshots.forEach((snapshot) => transaction.objectStore('snapshots').put(snapshot))
            // Cache freshness follows the replay clock; source capture time is retained in the fixture.
            transaction.objectStore('responses').put(
                {
                    at: Date.now(),
                    generation: 1,
                    data: { ...variants.catalog, updatedAt: Date.now() },
                },
                'td-citybus-variants-v1',
            )
            transaction.oncomplete = () => {
                request.result.close()
                resolve()
            }
            transaction.onerror = () => reject(transaction.error)
        }
    })
}

let scheme = 'light'
let frameHtml = ''
const server = createServer(async (request, response) => {
    try {
        if (request.url === '/__frame') {
            response.setHeader('Content-Type', 'text/html')
            response.end(frameHtml)
            return
        }
        if (request.url === '/__capture') {
            response.setHeader('Content-Type', 'text/html')
            response.end(
                '<style>body{margin:0}iframe{border:0;width:393px;height:852px}</style>' +
                    '<iframe src="/"></iframe>',
            )
            return
        }
        const upstream = await fetch(new URL(request.url, origin))
        let body = Buffer.from(await upstream.arrayBuffer())
        const type = upstream.headers.get('content-type') ?? ''
        if (request.url.startsWith('/src/workers/catalog.worker.ts')) {
            body = Buffer.from(
                `(${installReplay.toString()})(${JSON.stringify(fixture)});\n${body}`,
            )
        }
        if (request.url.startsWith('/src/styles/')) {
            body = Buffer.from(
                body
                    .toString()
                    .replaceAll('env(safe-area-inset-top)', '62px')
                    .replaceAll('env(safe-area-inset-bottom)', '34px')
                    .replaceAll(
                        '(prefers-color-scheme: dark)',
                        scheme === 'dark' ? 'all' : 'not all',
                    ),
            )
        }
        if (type.includes('text/html')) {
            const data = {
                fixture,
                variants,
                snapshots,
                bookmarks: [bookmarks[scheme === 'light' ? 0 : 1]],
                scheme,
            }
            const setup = JSON.stringify(data).replaceAll('<', '\\u003c')
            // Await fixture setup before Vite's application entry module runs.
            body = Buffer.from(
                body
                    .toString()
                    .replace(
                        '<head>',
                        `<head><script>const installReplay = ${installReplay.toString()}; window.captureReady = (${bootstrap.toString()})(${setup})</script>`,
                    )
                    .replace('src="/src/main.tsx"', 'src="/__entry"'),
            )
        }
        if (request.url === '/__entry') {
            response.setHeader('Content-Type', 'text/javascript')
            response.end('await window.captureReady; await import("/src/main.tsx")')
            return
        }
        response.statusCode = upstream.status
        response.setHeader('Content-Type', type)
        response.end(body)
    } catch (error) {
        response.statusCode = 500
        response.end(String(error))
    }
})
let session
async function command(path, data, method = data === undefined ? 'GET' : 'POST') {
    const response = await fetch(`${driver}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
        signal: AbortSignal.timeout(60000),
    })
    const { value } = await response.json()
    if (!response.ok || value?.error) throw new Error(JSON.stringify(value))
    return value
}
const execute = (script, args = []) => command(`/session/${session}/execute/sync`, { script, args })
async function waitFor(script) {
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
        if (await execute(script)) return
        await new Promise((resolve) => setTimeout(resolve, 150))
    }
    console.error(
        await execute(
            'return {url: location.href, text: document.body.innerText, errors: window.captureErrors}',
        ),
    )
    throw new Error(`Safari capture readiness timed out: ${script}`)
}
async function settleRendering() {
    await command(`/session/${session}/execute/async`, {
        script: `const done = arguments[arguments.length - 1]
        document.fonts.ready.then(() => Promise.all(
            document.getAnimations()
                .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
                .map(animation => animation.finished.catch(() => {})),
        )).then(() => setTimeout(done, 3000))`,
        args: [],
    })
}
async function screenshot(selector, path) {
    const rect = await execute(
        `const rect = document.querySelector(arguments[0]).getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewport: innerWidth }`,
        [selector],
    )
    const viewport = Buffer.from(await command(`/session/${session}/screenshot`), 'base64')
    const metadata = await sharp(viewport).metadata()
    const scale = metadata.width / rect.viewport
    const png = await sharp(viewport)
        .extract({
            left: Math.round(rect.x * scale),
            top: Math.round(rect.y * scale),
            width: Math.round(rect.width * scale),
            height: Math.round(rect.height * scale),
        })
        .png()
        .toBuffer()
    await writeFile(path, png)
    return png
}

await mkdir('docs/images', { recursive: true })
await mkdir('artifacts/readme', { recursive: true })
try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const captureOrigin = `http://127.0.0.1:${server.address().port}`
    const created = await command('/session', {
        capabilities: { alwaysMatch: { browserName: 'safari' } },
    })
    session = created.sessionId
    console.log(`Capturing with Safari ${created.capabilities.browserVersion}`)
    await command(`/session/${session}/window/rect`, { width: 800, height: 1200 })
    for (scheme of ['light', 'dark']) {
        await command(`/session/${session}/url`, { url: `${captureOrigin}/__capture` })
        const iframe = await command(`/session/${session}/element`, {
            using: 'css selector',
            value: 'iframe',
        })
        await command(`/session/${session}/frame`, { id: iframe })
        await waitFor(
            'return window.captureWorkerReady && document.documentElement.dataset.theme === "blue" && document.querySelectorAll(".arrival-time").length > 0 && !document.querySelector(".arrival-skeleton, .arrival-panel.stale, .arrival-top button[aria-busy=true]")',
        )
        for (const screen of ['saved', 'route']) {
            if (screen === 'route') {
                await execute('document.querySelector(".bookmark-route").click()')
                await waitFor(
                    'return document.querySelector(".route-heading .route-badge") && !document.querySelector(".arrival-skeleton, .arrival-top button[aria-busy=true]")',
                )
                if (scheme === 'dark')
                    await execute(
                        'document.querySelector(".stop-row.expanded .stop-main")?.click()',
                    )
            }
            await settleRendering()
            const rendering = await execute(`return {
                userAgent: navigator.userAgent,
                viewport: [innerWidth, innerHeight],
                backingScale: devicePixelRatio,
                glassEffective: document.documentElement.dataset.glassEffective,
                materials: [...document.querySelectorAll('.glass')].map(element => ({
                    backdropFilter: getComputedStyle(element).backdropFilter,
                    background: getComputedStyle(element).backgroundColor,
                })),
            }`)
            await writeFile(
                `artifacts/readme/rendering-${screen}-${scheme}.json`,
                JSON.stringify(rendering, null, 4) + '\n',
            )
            const errors = await execute('return window.captureErrors')
            if (errors.length) throw new Error(`Uncaptured requests: ${errors.join(', ')}`)
            await command(`/session/${session}/frame`, { id: null })
            const capture = await screenshot('iframe', `artifacts/readme/${screen}-${scheme}.png`)
            const ink = scheme === 'light' ? '#17243a' : '#f0edf2'
            const replacements = {
                STATUS_CSS: statusCss,
                INK: ink,
                FILTER: scheme === 'dark' ? 'invert(1)' : 'none',
                CAPTURE: `data:image/png;base64,${capture.toString('base64')}`,
                TIME: new Date(fixture.capturedAt).toLocaleTimeString('en-GB', {
                    timeZone: 'Asia/Hong_Kong',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }),
                STATUS: `data:image/svg+xml;base64,${status.toString('base64')}`,
                BEZEL: `data:image/png;base64,${bezel.toString('base64')}`,
            }
            frameHtml = frameTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key])
            // A second Safari tab preserves the running app while composing the frame.
            const appHandle = await command(`/session/${session}/window`)
            const frame = await command(`/session/${session}/window/new`, { type: 'tab' })
            await command(`/session/${session}/window`, { handle: frame.handle })
            await command(`/session/${session}/url`, { url: `${captureOrigin}/__frame` })
            await waitFor(
                'return [...document.images].every(img => img.complete && img.naturalWidth > 0)',
            )
            await settleRendering()
            const framed = await screenshot(
                '.phone',
                `artifacts/readme/frame-${screen}-${scheme}.png`,
            )
            // Safari controls the native backing scale; normalize only the published PNG dimensions.
            await sharp(framed)
                .resize(1533, 2904)
                .png()
                .toFile(`docs/images/iphone17-${screen}-${scheme}.png`)
            await command(`/session/${session}/window`, undefined, 'DELETE')
            await command(`/session/${session}/window`, { handle: appHandle })
            await command(`/session/${session}/frame`, { id: iframe })
            console.log(`Rendered ${screen}-${scheme}`)
        }
        await command(`/session/${session}/frame`, { id: null })
    }
} finally {
    if (session) await command(`/session/${session}`, undefined, 'DELETE')
    server.closeAllConnections()
    server.close()
}
