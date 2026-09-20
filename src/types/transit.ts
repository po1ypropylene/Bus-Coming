export type Lang = 'en' | 'tc'
export type Provider = 'KMB' | 'CTB' | 'NLB'
export type Localized = { en: string; tc: string }
export interface Stop {
  id: string
  code: string
  provider: Provider
  name: Localized
  lat: number
  lng: number
  metadataMissing?: boolean
}
export interface Route {
  id: string
  number: string
  provider: Provider
  bound: 'O' | 'I'
  service: string
  origin: Localized
  destination: Localized
  stops: { id: string; seq: number }[]
}
export interface Snapshot {
  provider: Provider
  updatedAt: number
  routes: Route[]
  stops: Record<string, Stop>
  stopRoutes: Record<string, { routeId: string; seq: number }[]>
}
export interface Bookmark {
  id: string
  routeId: string
  stopId: string
  seq: number
  group: string
  route: Route
  stop: Stop
}
export interface UserData {
  version: 1
  language: Lang
  bookmarks: Bookmark[]
}
export interface Arrival {
  time: number | null
  remark: string
}
export interface ArrivalResult {
  arrivals: Arrival[]
  fetchedAt: number
}
export interface Progress {
  provider: Provider
  done: number
  total: number
  state: 'downloading' | 'ready' | 'error'
}
export const PROVIDERS: Provider[] = ['KMB', 'CTB', 'NLB']
export const WEEK = 7 * 24 * 60 * 60 * 1000
export const FALLBACK_LETTERS = 'ABCDEFGHKMNOPRSTWX'.split('')

export type Tab = 'saved' | 'nearby' | 'search' | 'settings'

// Lightweight route index becomes searchable before the complete offline snapshot.
export interface RouteCatalog {
  provider: Provider
  updatedAt: number
  routes: Route[]
}
export interface RouteDetails {
  id: string
  updatedAt: number
  route: Route
  stops: Record<string, Stop>
}
export type CatalogEvent =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'catalog'; catalog: RouteCatalog }
  | { type: 'progress'; progress: Progress }
  | { type: 'complete' }
