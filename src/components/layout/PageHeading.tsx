import { useApp } from '../../app/AppContext'
export function PageHeading() {
  const { tab, t } = useApp()
  return (
    <div className="page-heading">
      <p className="eyebrow">
        {tab === 'saved'
          ? t.today
          : tab === 'search'
            ? 'HONG KONG · 香港'
            : tab === 'nearby'
              ? t.nearby
              : t.settings}
      </p>
      <h1>
        {tab === 'saved'
          ? t.savedTitle
          : tab === 'search'
            ? t.searchTitle
            : tab === 'nearby'
              ? t.nearbyTitle
              : t.settingsTitle}
      </h1>
      {tab !== 'settings' && (
        <p>{tab === 'saved' ? t.savedSub : tab === 'search' ? t.searchSub : t.nearbySub}</p>
      )}
    </div>
  )
}
