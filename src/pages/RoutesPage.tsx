import { useEffect, useRef } from 'react'
import { Download, Search, X } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { CatalogStatus } from '../components/catalog/CatalogStatus'
import { DownloadCard } from '../components/catalog/DownloadCard'
import { RouteKeypad } from '../components/routes/RouteKeypad'
import { RouteRow } from '../components/routes/RouteRow'
import { PROVIDERS } from '../types/transit'

export function RoutesPage() {
    const {
        t,
        tc,
        query,
        setQuery,
        operator,
        setOperator,
        limit,
        setLimit,
        keypad,
        setKeypad,
        letters,
        snapshots,
        routes,
        filtered,
        openRoute,
    } = useApp()
    const resultsRef = useRef<HTMLElement>(null)
    useEffect(() => {
        resultsRef.current?.scrollTo({ top: 0 })
    }, [query, operator])
    const operatorMissing = operator !== 'all' && !routes.some((r) => r.provider === operator)
    return (
        <div className="search-layout">
            <section className="search-controls">
                <div className="search-entry">
                    <div className="search-box">
                        <Search size={22}/>
                        <input
                            aria-label={t.routeNumber}
                            inputMode="none"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder={tc ? '輸入路線號碼' : 'Enter route number'}
                            value={query}
                            onChange={(e) => {
                                setQuery(
                                    e.target.value
                                        .toUpperCase()
                                        .replace(/[^A-Z0-9]/g, '')
                                        .slice(0, 8),
                                )
                                setLimit(40)
                            }}
                        />
                        {query && (
                            <button
                                className="icon-button"
                                aria-label={t.clear}
                                onClick={() => setQuery('')}
                            >
                                <X size={18}/>
                            </button>
                        )}
                    </div>
                    <div className="operator-tabs" aria-label={t.allOperators}>
                        {['all', ...PROVIDERS].map((co) => (
                            <button
                                key={co}
                                className={operator === co ? 'selected' : ''}
                                onClick={() => {
                                    setOperator(co)
                                    setLimit(40)
                                }}
                            >
                                {co === 'all'
                                    ? t.all
                                    : co === 'KMB'
                                        ? tc
                                            ? '九巴/龍運'
                                            : 'KMB/LWB'
                                        : co === 'CTB'
                                            ? tc
                                                ? '城巴'
                                                : 'Citybus'
                                            : tc
                                                ? '嶼巴'
                                                : 'NLB'}
                            </button>
                        ))}
                    </div>
                    <div className="keypad-heading">
                        <span>{t.keyHint}</span>
                        <button className="text-button" onClick={() => setKeypad(!keypad)}>
                            {keypad ? t.hideKeypad : t.showKeypad}
                        </button>
                    </div>
                </div>
                {keypad && (
                    <RouteKeypad
                        t={t}
                        letters={letters}
                        setQuery={setQuery}
                        onChange={() => setLimit(40)}
                    />
                )}
                <p className="footnote">
                    <Download size={14} />
                    {snapshots.length === 3 ? t.ready : t.downloadingHint}
                </p>
            </section>
            <section
                className="search-results"
                ref={resultsRef}
                aria-label={t.results}
                tabIndex={0}
            >
                <CatalogStatus />
                <div className="section-heading">
                    <h2>{t.results}</h2>
                    <span>{filtered.length}</span>
                </div>
                {!routes.length ? (
                    <DownloadCard />
                ) : filtered.length ? (
                    <>
                        <div className="list-card">
                            {filtered.slice(0, limit).map((r) => (
                                <RouteRow key={r.id} route={r} onClick={() => openRoute(r)} />
                            ))}
                        </div>
                        {filtered.length > limit && (
                            <button
                                className="secondary full more-button"
                                onClick={() => setLimit((l) => l + 40)}
                            >
                                {t.more}
                            </button>
                        )}
                    </>
                ) : (
                    <div className="empty-inline">
                        <Search size={32} />
                        <h2>{operatorMissing ? t.downloading : t.noRoutes}</h2>
                        <p>{operatorMissing ? t.operatorPending : t.noRoutesBody}</p>
                    </div>
                )}
            </section>
        </div>
    )
}
