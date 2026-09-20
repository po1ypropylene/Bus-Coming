import type { Route, RouteCatalog } from '../../types/transit'
import { name, pool, stopCollector, type CatalogClient, type Row } from './shared'

export function citybusRoutes(rows: Row[]): Route[] {
  return rows.flatMap((row) =>
    (['O', 'I'] as const).map((bound) => ({
      id: `CTB:${row.route}:${bound}:1`,
      number: String(row.route),
      provider: 'CTB' as const,
      bound,
      service: '1',
      origin: name(row, bound === 'O' ? 'orig' : 'dest'),
      destination: name(row, bound === 'O' ? 'dest' : 'orig'),
      stops: [],
    })),
  )
}
export async function citybusRouteStops(route: Route, get: CatalogClient['get']) {
  const response = await get(
    `/route-stop/CTB/${encodeURIComponent(route.number)}/${route.bound === 'O' ? 'outbound' : 'inbound'}`,
  )
  if (!Array.isArray(response.data)) throw new Error('Invalid Citybus route stops')
  return response.data
    .map((row) => ({ id: `CTB:${row.stop}`, seq: Number(row.seq) }))
    .sort((a, b) => a.seq - b.seq)
}
export async function citybusStops(ids: string[], get: CatalogClient['get']) {
  const { stops, addStop } = stopCollector('CTB')
  await pool(ids, async (id) => {
    const response = await get(`/stop/${encodeURIComponent(id)}`)
    addStop(response.data as unknown as Row)
  })
  return stops
}
export async function downloadCitybus(
  { get, addTotal }: CatalogClient,
  publish: (catalog: RouteCatalog) => Promise<void>,
) {
  const response = await get('/route/CTB')
  if (!Array.isArray(response.data) || !response.data.length)
    throw new Error('Empty Citybus catalogue')
  const routes = citybusRoutes(response.data)
  // Persist only the route index here. Complete offline data is still committed atomically.
  await publish({ provider: 'CTB', updatedAt: Date.now(), routes })
  addTotal(routes.length)
  await pool(routes, async (route) => {
    route.stops = await citybusRouteStops(route, get)
  })
  const ids = [...new Set(routes.flatMap((route) => route.stops.map((stop) => stop.id.slice(4))))]
  addTotal(ids.length)
  return { routes, stops: await citybusStops(ids, get) }
}
