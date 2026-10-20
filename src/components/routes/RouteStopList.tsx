import { Bookmark as BookmarkIcon, ChevronRight } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { ArrivalPanel } from '../arrivals/ArrivalPanel'
import type { Route, Stop } from '../../types/transit'

export interface DisplayStop {
    key: string
    stop: Stop
    api?: { route: Route; stop: Stop; seq: number }
}

export function RouteStopList({
    entries,
    stops,
}: {
    entries: DisplayStop[]
    stops: Record<string, Stop>
}) {
    const { selectedStop, setSelectedStop, user, bookmark, lang, tc, t } = useApp()
    return (
        <div className="stop-list">
            {entries.map(({ key, stop, api }, index) => {
                const expanded = selectedStop === key
                const saved =
                    api &&
                    user.bookmarks.some(
                        (b) =>
                            b.routeId === api.route.id &&
                            b.stopId === api.stop.id &&
                            b.seq === api.seq,
                    )
                return (
                    <article
                        key={`${key}:${index}`}
                        className={`stop-row ${expanded ? 'expanded' : ''}`}
                    >
                        <button
                            className="stop-main"
                            onClick={() => setSelectedStop(expanded ? null : key)}
                            aria-expanded={expanded}
                        >
                            <span className="stop-sequence">{index + 1}</span>
                            <span>
                                <strong>{stop.name[lang]}</strong>
                                <small>{stop.name[tc ? 'en' : 'tc']}</small>
                            </span>
                            <ChevronRight size={18} />
                        </button>
                        {expanded && (
                            <div className="stop-expanded">
                                {api ? (
                                    <>
                                        <ArrivalPanel
                                            key={`${api.route.id}:${key}:${lang}`}
                                            route={api.route}
                                            knownStops={stops}
                                            stop={api.stop}
                                            seq={api.seq}
                                            lang={lang}
                                            t={t}
                                        />
                                        <button
                                            className="text-button full"
                                            onClick={() => bookmark(api.route, api.stop, api.seq)}
                                        >
                                            <BookmarkIcon
                                                size={17}
                                                fill={saved ? 'currentColor' : 'none'}
                                            />
                                            {saved ? t.savedStop : t.save}
                                        </button>
                                    </>
                                ) : (
                                    <p className="banner">{t.variantStopUnavailable}</p>
                                )}
                            </div>
                        )}
                    </article>
                )
            })}
        </div>
    )
}
