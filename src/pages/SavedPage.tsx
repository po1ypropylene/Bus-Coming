import {
  ArrowUpRight,
  Bookmark as BookmarkIcon,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useApp } from '../app/AppContext'
import { ArrivalPanel } from '../components/arrivals/ArrivalPanel'
import { DownloadCard } from '../components/catalog/DownloadCard'
import { JourneyArt } from '../components/illustrations/JourneyArt'
import { RouteBadge } from '../components/routes/RouteBadge'
import { company } from '../i18n'
import { resolveBookmark } from '../utils/transit'
export function SavedPage() {
  const {
    t,
    tc,
    user,
    snapshots,
    lang,
    openRoute,
    updateUser,
    setSaveItem,
    navigate,
    activeGroup,
    setActiveGroup,
    groups,
  } = useApp()
  return (
    <div className="home-layout">
      <div>
        <div className="section-toolbar">
          <div className="chips">
            <button
              className={!activeGroup ? 'chip active' : 'chip'}
              onClick={() => setActiveGroup('')}
            >
              {t.all}
              <span>{user.bookmarks.length}</span>
            </button>
            {groups.map((group) => (
              <button
                key={group}
                className={activeGroup === group ? 'chip active' : 'chip'}
                onClick={() => setActiveGroup(group)}
              >
                {group}
              </button>
            ))}
          </div>
          <button
            className="icon-button add-button"
            onClick={() => navigate('search')}
            aria-label={t.addStop}
          >
            <Plus size={21} />
          </button>
        </div>
        {!user.bookmarks.length ? (
          <section className="empty-saved">
            <JourneyArt />
            <h2>{t.noSaved}</h2>
            <p>{t.noSavedBody}</p>
            <button className="primary" onClick={() => navigate('search')}>
              <Plus size={18} />
              {t.addStop}
            </button>
            <span className="tiny-note">
              <BookmarkIcon size={13} />
              {t.privacy}
            </span>
          </section>
        ) : (
          <div className="bookmark-list">
            {user.bookmarks
              .filter((b) => !activeGroup || b.group === activeGroup)
              .map((b) => {
                const { route, stop, available } = resolveBookmark(b, snapshots)
                return (
                  <article className="bookmark-card" key={b.id}>
                    <div className="bookmark-label">
                      <span>
                        <MapPin size={14} />
                        {b.group || t.ungrouped}
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => setSaveItem(b)}
                        aria-label={t.edit}
                      >
                        <Settings2 size={17} />
                      </button>
                    </div>
                    <button
                      className="bookmark-route"
                      onClick={() => openRoute(route, { id: stop.id, seq: b.seq })}
                    >
                      <RouteBadge route={route} />
                      <span>
                        <strong>{stop.name[lang]}</strong>
                        <small>
                          {t.toward} {route.destination[lang]}
                        </small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                    {available ? (
                      <ArrivalPanel
                        key={`${b.id}:${lang}`}
                        route={route}
                        stop={stop}
                        seq={b.seq}
                        lang={lang}
                        t={t}
                      />
                    ) : (
                      <p className="banner">{t.missingRoute}</p>
                    )}
                    <div className="bookmark-bottom">
                      <span>{company(route.provider, tc)}</span>
                      <button
                        className="icon-button"
                        onClick={() => {
                          updateUser({
                            ...user,
                            bookmarks: user.bookmarks.filter((item) => item.id !== b.id),
                          })
                          setActiveGroup('')
                        }}
                        aria-label={t.remove}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                )
              })}
          </div>
        )}
      </div>
      <aside className="home-aside">
        <button className="nearby-promo" onClick={() => navigate('nearby')}>
          <div className="promo-icon">
            <Navigation size={23} />
          </div>
          <span className="eyebrow">{tc ? '下一站，出發' : 'A LITTLE EXPLORING'}</span>
          <h2>{t.discover}</h2>
          <p>{t.discoverBody}</p>
          <span className="promo-link">
            {t.explore}
            <ArrowUpRight size={19} />
          </span>
          <div className="promo-map" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>
              <MapPin size={28} />
            </span>
          </div>
        </button>
        <div className="home-note">
          <span className="round-icon small">
            <Clock3 size={19} />
          </span>
          <p>
            {t.minuteRefresh}
            <small>{t.attribution}</small>
          </p>
        </div>
        {snapshots.length === 0 && <DownloadCard />}
      </aside>
    </div>
  )
}
