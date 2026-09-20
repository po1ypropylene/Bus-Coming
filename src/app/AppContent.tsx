import { Check, RefreshCw, WifiOff } from 'lucide-react'
import { useApp } from './AppContext.ts'
import { SaveDialog } from '../components/bookmarks/SaveDialog'
import { AppHeader } from '../components/layout/AppHeader'
import { PageHeading } from '../components/layout/PageHeading'
import { TabBar } from '../components/layout/TabBar'
import { NearbyPage } from '../pages/NearbyPage'
import { RouteDetailsPage } from '../pages/RouteDetailsPage'
import { RoutesPage } from '../pages/RoutesPage'
import { SavedPage } from '../pages/SavedPage'
import { SettingsPage } from '../pages/SettingsPage'

export function AppContent() {
    const {
        online,
        saveError,
        storageError,
        t,
        currentRoute,
        tab,
        busy,
        snapshots,
        saveItem,
        groups,
        setSaveItem,
        user,
        updateUser,
        setNotice,
        notice,
    } = useApp()
    return (
        <div className="app-shell">
            <AppHeader />
            <main id="main">
                {!online && (
                    <div className="banner">
                        <WifiOff size={17} />
                        {t.offline}
                    </div>
                )}
                {(saveError || storageError) && (
                    <div className="banner error" role="alert">
                        {t.storageError}
                    </div>
                )}
                {currentRoute ? (
                    <RouteDetailsPage />
                ) : (
                    <>
                        <PageHeading />
                        {tab === 'saved' && <SavedPage />}
                        {tab === 'search' && <RoutesPage />}
                        {tab === 'nearby' && <NearbyPage />}
                        {tab === 'settings' && <SettingsPage />}
                    </>
                )}
                {busy && snapshots.length > 0 && tab !== 'settings' && (
                    <div className="background-status" role="status">
                        <RefreshCw size={12} className="spin" />
                        {t.downloadingHint}
                    </div>
                )}
            </main>
            <TabBar />
            {saveItem && (
                <SaveDialog
                    key={saveItem.id}
                    item={saveItem}
                    groups={groups}
                    t={t}
                    onClose={() => setSaveItem(null)}
                    onSave={(group) => {
                        updateUser({
                            ...user,
                            bookmarks: [
                                ...user.bookmarks.filter((b) => b.id !== saveItem.id),
                                { ...saveItem, group },
                            ],
                        })
                        setSaveItem(null)
                        setNotice(t.savedStop)
                        void navigator.storage?.persist?.().catch(() => {})
                    }}
                />
            )}
            {notice && (
                <div className="toast" role="status">
                    <Check size={17} />
                    {notice}
                </div>
            )}
        </div>
    )
}
