import type { Route } from '../../types/transit'
import { name, pool, stopCollector, type CatalogClient, type Row } from './shared'
export async function downloadKMB({ get, addTotal }: CatalogClient) {
  const provider = 'KMB' as const
  const { stops, addStop } = stopCollector(provider)
  const [catalog, stopList, links] = await Promise.all([
    get('/route/'),
    get('/stop'),
    get('/route-stop'),
  ])
  const routes: Route[] = catalog.data.map((r) => ({
    id: `KMB:${r.route}:${r.bound}:${r.service_type}`,
    number: String(r.route),
    provider,
    bound: r.bound as 'O' | 'I',
    service: String(r.service_type),
    origin: name(r, 'orig'),
    destination: name(r, 'dest'),
    stops: [],
  }))
  stopList.data.forEach(addStop)
  const byId = new Map(routes.map((r) => [r.id, r]))
  links.data.forEach((r) =>
    byId
      .get(`KMB:${r.route}:${r.bound}:${r.service_type}`)
      ?.stops.push({ id: `KMB:${r.stop}`, seq: Number(r.seq) }),
  )
  // Operator bulk datasets are not necessarily an internally consistent snapshot.
  const missing = [
    ...new Set(
      routes.flatMap((r) => r.stops.filter((s) => !stops[s.id]).map((s) => s.id.slice(4))),
    ),
  ]
  addTotal(missing.length)
  await pool(missing, async (code) => {
    const response = await get(`/stop/${code}`)
    const row = response.data as unknown as Row
    if (row && !Array.isArray(row) && row.stop && row.name_en && row.name_tc) addStop(row)
    else
      stops[`KMB:${code}`] = {
        id: `KMB:${code}`,
        code,
        provider,
        name: { en: `Stop details unavailable (${code})`, tc: `車站資料暫缺（${code}）` },
        lat: 0,
        lng: 0,
        metadataMissing: true,
      }
  })

  return { routes, stops }
}
