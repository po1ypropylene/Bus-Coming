import { Check, CloudDownload, RefreshCw } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { company } from '../../i18n'
import { PROVIDERS } from '../../types/transit'

export function DownloadCard() {
    const { t, tc, progress, busy, refresh } = useApp()
    return (
        <section className="download-card">
            <div className="round-icon">
                <CloudDownload size={26} />
            </div>
            <h2>{t.downloadTitle}</h2>
            <p>{t.downloadBody}</p>
            <div className="download-providers">
                {PROVIDERS.map((provider) => {
                    const p = progress.find((p) => p.provider === provider)
                    return (
                        <div key={provider}>
                            <span>{company(provider, tc)}</span>
                            <span>
                                {p?.state === 'ready' ? (
                                    <Check size={17} />
                                ) : p?.state === 'error' ? (
                                    t.failed
                                ) : p?.state === 'downloading' ? (
                                    `${p.done} / ${p.total}`
                                ) : (
                                    t.pending
                                )}
                            </span>
                        </div>
                    )
                })}
            </div>
            <button className="secondary full" disabled={busy} onClick={() => refresh()}>
                <RefreshCw size={17} className={busy ? 'spin' : ''} />
                {busy ? t.downloading : t.retry}
            </button>
        </section>
    )
}
