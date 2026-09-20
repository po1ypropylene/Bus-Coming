import { mkdir, writeFile } from 'node:fs/promises'
const endpoints = {
  KMB: 'https://data.etabus.gov.hk/v1/transport/kmb/route/',
  CTB: 'https://rt.data.gov.hk/v2/transport/citybus/route/CTB',
  NLB: 'https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list',
}
async function fetchJSON(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { Origin: 'http://localhost:5173' },
  })
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return {
    url,
    cors: response.headers.get('access-control-allow-origin'),
    payload: await response.json(),
  }
}
const output = { checkedAt: new Date().toISOString(), operators: {}, samples: {} }
for (const [provider, url] of Object.entries(endpoints)) {
  const { payload, cors } = await fetchJSON(url)
  const rows = payload.data ?? payload.routes
  output.operators[provider] = {
    url,
    cors,
    count: rows.length,
    letters: [...new Set(rows.flatMap((r) => (r.route ?? r.routeNo).match(/[A-Z]/g) ?? []))].sort(),
    example: rows[0],
  }
  console.log(provider, rows.length, output.operators[provider].letters.join(' '))
}
const samples = {
  kmbStop: 'https://data.etabus.gov.hk/v1/transport/kmb/stop',
  kmbRouteStops: 'https://data.etabus.gov.hk/v1/transport/kmb/route-stop/1/outbound/1',
  citybusStops: 'https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/1/outbound',
  citybusStop: 'https://rt.data.gov.hk/v2/transport/citybus/stop/002737',
  citybusEta: 'https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/002737/1',
  nlbStops: 'https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=1',
  nlbEta:
    'https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId=1&stopId=1&language=en',
}
for (const [name, url] of Object.entries(samples)) {
  const { payload, cors } = await fetchJSON(url)
  const rows = payload.data ?? payload.stops ?? payload.estimatedArrivals
  output.samples[name] = {
    url,
    cors,
    count: Array.isArray(rows) ? rows.length : undefined,
    example: Array.isArray(rows) ? rows.slice(0, 2) : payload,
  }
  if (name === 'kmbRouteStops' && rows.length) {
    const eta = await fetchJSON(
      `https://data.etabus.gov.hk/v1/transport/kmb/eta/${rows[0].stop}/1/1`,
    )
    output.samples.kmbEta = { url: eta.url, cors: eta.cors, example: eta.payload.data.slice(0, 3) }
  }
  console.log(name, 'OK', cors)
}
await mkdir('docs', { recursive: true })
await writeFile('docs/api-audit.json', JSON.stringify(output, null, 2) + '\n')
