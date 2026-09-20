import { useEffect, useMemo, useState } from 'react'
import { useCatalog } from './useCatalog.ts'
import { strings } from '../i18n'
import { type Bookmark, type Route, type Stop, type Tab } from '../types/transit'
import { useBackups } from './useBackups'
import { useNearbyStops } from './useNearbyStops'
import { useOnline } from './useOnline'
import { useRouteSearch } from './useRouteSearch'
import { useUserData } from './useUserData'
export function useAppController() {
  const { snapshots, catalogs, progress, busy, storageError, refresh } = useCatalog()
  const { user, saveError, updateUser } = useUserData()
  const [tab, setTab] = useState<Tab>('saved')
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [selectedStop, setSelectedStop] = useState<string | null>(null)
  const [saveItem, setSaveItem] = useState<Bookmark | null>(null)
  const [activeGroup, setActiveGroup] = useState('')
  const [notice, setNotice] = useState('')
  const online = useOnline()
  const lang = user.language,
    t = strings[lang],
    tc = lang === 'tc'
  const routes = useMemo(
    () =>
      [
        ...snapshots.flatMap((s) => s.routes),
        ...catalogs
          .filter((c) => !snapshots.some((s) => s.provider === c.provider))
          .flatMap((c) => c.routes),
      ].sort(
        (a, b) =>
          a.number.localeCompare(b.number, 'en', { numeric: true }) ||
          a.provider.localeCompare(b.provider),
      ),
    [snapshots, catalogs],
  )
  const stops = useMemo(
    () => Object.assign({}, ...snapshots.map((s) => s.stops)) as Record<string, Stop>,
    [snapshots],
  )
  const search = useRouteSearch(routes, snapshots)
  const nearbyState = useNearbyStops(stops)
  const byRoute = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes])
  const groups = [...new Set(user.bookmarks.map((b) => b.group).filter(Boolean))]
  useEffect(() => {
    document.documentElement.lang = lang === 'tc' ? 'zh-Hant' : 'en'
    document.title = t.brand
  }, [lang, t.brand])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])
  function navigate(next: Tab) {
    setTab(next)
    setSelectedRoute(null)
    setSelectedStop(null)
    window.scrollTo({ top: 0 })
  }
  function openRoute(route: Route, stop?: { id: string; seq: number }) {
    setSelectedRoute(route)
    setSelectedStop(stop ? `${stop.id}:${stop.seq}` : null)
    window.scrollTo({ top: 0 })
  }
  function bookmark(route: Route, stop: Stop, seq: number) {
    const id = `${route.id}:${stop.id}:${seq}`
    setSaveItem(
      user.bookmarks.find((b) => b.id === id) ?? {
        id,
        routeId: route.id,
        stopId: stop.id,
        seq,
        route,
        stop,
        group: '',
      },
    )
  }

  const backups = useBackups(user, updateUser, setNotice, t)
  const currentRoute = selectedRoute ? (byRoute.get(selectedRoute.id) ?? selectedRoute) : null
  return {
    snapshots,
    progress,
    busy,
    storageError,
    refresh,
    user,
    saveError,
    tab,
    selectedRoute,
    setSelectedRoute,
    selectedStop,
    setSelectedStop,
    saveItem,
    setSaveItem,
    activeGroup,
    setActiveGroup,
    notice,
    setNotice,
    online,
    lang,
    t,
    tc,
    routes,
    stops,
    byRoute,
    groups,
    updateUser,
    navigate,
    openRoute,
    bookmark,
    currentRoute,
    ...search,
    ...nearbyState,
    ...backups,
  }
}
