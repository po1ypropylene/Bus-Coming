import { type Route } from '../../types/transit'
export function RouteBadge({ route }: { route: Route }) {
  return <span className={`route-badge ${route.provider.toLowerCase()}`}>{route.number}</span>
}
