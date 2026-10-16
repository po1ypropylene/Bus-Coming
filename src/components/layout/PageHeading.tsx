import { useApp } from '../../app/AppContext'

export function PageHeading() {
    const { tab, t, user } = useApp()
    return (
        <div
            className={`page-heading ${tab === 'saved' && !user.bookmarks.length ? '' : 'compact'}`}
        >
            {tab === 'saved' && !user.bookmarks.length ? (
                <>
                    <p className="eyebrow">{t.today}</p>
                    <h1>{t.savedTitle}</h1>
                    <p>{t.savedSub}</p>
                </>
            ) : (
                <h1>{t[tab]}</h1>
            )}
        </div>
    )
}
