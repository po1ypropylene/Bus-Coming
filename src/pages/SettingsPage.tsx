import { ThemePicker } from '../components/settings/ThemePicker'
import {
    ArrowDownToLine,
    ArrowUpRight,
    BusFront,
    ChevronRight,
    CloudDownload,
    Globe2,
    RefreshCw,
    Share2,
} from 'lucide-react'
import { useApp } from '../app/AppContext'
import { company } from '../i18n'
import { type Lang, PROVIDERS } from '../types/transit'

export function SettingsPage() {
    const {
        appUpdate,
        t,
        tc,
        user,
        lang,
        updateUser,
        snapshots,
        jointCatalog,
        jointError,
        progress,
        busy,
        refresh,
        exportBackup,
        importBackup,
        importInput,
    } = useApp()
    return (
        <div className="settings-layout">
            <div>
                {appUpdate.supported && (
                    <>
                        <div className="section-heading">
                            <h2>{t.appUpdate}</h2>
                        </div>
                        <section className="list-card">
                            <button
                                className="setting-action"
                                disabled={appUpdate.status === 'checking'}
                                onClick={() => void appUpdate.check()}
                            >
                                <RefreshCw size={18} />
                                {appUpdate.status === 'checking'
                                    ? t.updateChecking
                                    : t.checkAppUpdate}
                            </button>
                        </section>
                        <p className="setting-description" role="status">
                            {appUpdate.status === 'current'
                                ? t.updateCurrent
                                : appUpdate.status === 'error'
                                  ? t.updateError
                                  : appUpdate.status === 'ready'
                                    ? t.updateReady
                                    : ''}
                        </p>
                    </>
                )}
                <div className="section-heading">
                    <h2>{t.preferences}</h2>
                </div>
                <section className="list-card">
                    <div className="setting-row">
                        <span>
                            <Globe2 size={20} />
                            {t.language}
                        </span>
                        <select
                            aria-label={t.language}
                            value={lang}
                            onChange={(e) =>
                                updateUser({ ...user, language: e.target.value as Lang })
                            }
                        >
                            <option value="en">English</option>
                            <option value="tc">繁體中文</option>
                        </select>
                    </div>
                    <ThemePicker />
                </section>
                <div className="section-heading">
                    <h2>{t.routeData}</h2>
                    <CloudDownload size={16} />
                </div>
                <section className="list-card">
                    {PROVIDERS.map((provider) => {
                        const snapshot = snapshots.find((s) => s.provider === provider),
                            p = progress.find((p) => p.provider === provider)
                        return (
                            <div className="provider-setting" key={provider}>
                                <div>
                                    <strong>{company(provider, tc)}</strong>
                                    <span className={`status-pill ${snapshot ? 'ready' : ''}`}>
                                        {p?.state === 'downloading'
                                            ? t.downloading
                                            : snapshot
                                              ? t.ready
                                              : t.never}
                                    </span>
                                </div>
                                <p>
                                    {t.lastDownloaded}:{' '}
                                    {snapshot
                                        ? new Date(snapshot.updatedAt).toLocaleString(
                                              tc ? 'zh-HK' : 'en-GB',
                                          )
                                        : '—'}
                                </p>
                                {snapshot && (
                                    <small>
                                        {snapshot.routes.length} {t.results.toLowerCase()} ·{' '}
                                        {Object.keys(snapshot.stops).length} {t.stops}
                                    </small>
                                )}
                                {p?.state === 'downloading' && (
                                    <>
                                        <progress value={p.done} max={p.total} />
                                        <small>
                                            {p.done} / {p.total}
                                        </small>
                                    </>
                                )}
                                {p?.state === 'error' && <p className="error-text">{t.failed}</p>}
                            </div>
                        )
                    })}
                    <div className="provider-setting">
                        <strong>{t.jointData}</strong>
                        <p>
                            {t.lastDownloaded}:{' '}
                            {jointCatalog
                                ? new Date(jointCatalog.updatedAt).toLocaleString(
                                      tc ? 'zh-HK' : 'en-GB',
                                  )
                                : '—'}
                        </p>
                        {jointError && <p className="error-text">{t.failed}</p>}
                    </div>
                    <button className="setting-action" disabled={busy} onClick={() => refresh()}>
                        <RefreshCw size={18} className={busy ? 'spin' : ''} />
                        {busy ? t.downloading : t.refreshData}
                    </button>
                </section>
                <p className="setting-description">{t.weekly}</p>
                <div className="section-heading">
                    <h2>{t.storage}</h2>
                </div>
                <section className="list-card">
                    <button className="setting-action" onClick={exportBackup}>
                        <ArrowDownToLine size={19} />
                        {t.export}
                        <ChevronRight size={16} />
                    </button>
                    <button className="setting-action" onClick={() => importInput.current?.click()}>
                        <Share2 size={19} />
                        {t.import}
                        <ChevronRight size={16} />
                    </button>
                    <input
                        ref={importInput}
                        type="file"
                        accept="application/json,.json"
                        className="visually-hidden"
                        aria-label={t.import}
                        onChange={(e) => void importBackup(e.target.files?.[0])}
                    />
                </section>
                <p className="setting-description">{t.storageHint}</p>
            </div>
            <aside>
                <section className="install-card">
                    <span className="brand-icon large">
                        <BusFront size={33} />
                    </span>
                    <p className="eyebrow">{t.install}</p>
                    <h2>{t.installTitle}</h2>
                    <p>{t.installBody}</p>
                    <small>{t.installOffline}</small>
                </section>
                <div className="about">
                    <strong>{t.about}</strong>
                    <p>{t.attribution}</p>
                    <a
                        href="https://data.gov.hk/en-datasets/category/transport"
                        target="_blank"
                        rel="noreferrer"
                    >
                        DATA.GOV.HK <ArrowUpRight size={14} />
                    </a>
                    <p>Bus Coming · v1.0</p>
                </div>
            </aside>
        </div>
    )
}
