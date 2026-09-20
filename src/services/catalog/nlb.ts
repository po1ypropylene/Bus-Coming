import type { Route } from '../../types/transit'
import { pool, stopCollector, type CatalogClient } from './shared'
export async function downloadNLB({ get, addTotal }: CatalogClient) {
  const provider = 'NLB' as const
  const { stops, addStop } = stopCollector(provider)
  const catalog = await get('/route.php?action=list')
  addTotal(catalog.routes.length)
  const routes: Route[] = catalog.routes.map((r) => {
    const en = String(r.routeName_e).split(' > '),
      tc = String(r.routeName_c).split(' > ')
    return {
      id: `NLB:${r.routeId}`,
      number: String(r.routeNo),
      provider,
      bound: 'O',
      service: String(r.routeId),
      origin: { en: en[0], tc: tc[0] },
      destination: { en: en.slice(1).join(' > ') || en[0], tc: tc.slice(1).join(' > ') || tc[0] },
      stops: [],
    }
  })
  await pool(routes, async (route) => {
    const response = await get(`/stop.php?action=list&routeId=${route.service}`)
    if (!Array.isArray(response.stops) || !response.stops.length)
      throw new Error('Invalid NLB stops')
    route.stops = response.stops.map((s, index) => {
      const code = String(s.stopId),
        id = `NLB:${code}`
      addStop({
        stop: code,
        name_en: s.stopName_e,
        name_tc: s.stopName_c,
        lat: s.latitude,
        long: s.longitude,
      })
      return { id, seq: index + 1 }
    })
  })

  return { routes, stops }
}
