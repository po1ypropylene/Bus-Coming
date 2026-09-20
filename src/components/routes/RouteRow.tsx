import { ChevronRight } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { RouteBadge } from '../../components/routes/RouteBadge'
import { company } from '../../i18n'
import { type Route } from '../../types/transit'

export function RouteRow({ route, onClick }: { route: Route; onClick: () => void }) {
    const { t, tc, lang } = useApp()
    return (
        <button className="route-row" key={route.id} onClick={onClick}>
            <RouteBadge route={route} />
            <span className="route-copy">
                <span className="route-company">
                    {company(route.provider, tc)}
                    {route.provider === 'KMB' && route.service !== '1'
                        ? ` · ${t.service} ${route.service}`
                        : ''}
                </span>
                <strong>{route.destination[lang]}</strong>
                <small>
                    {t.from} {route.origin[lang]}
                </small>
            </span>
            <ChevronRight size={19} />
        </button>
    )
}
