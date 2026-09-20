import { type DBSchema, openDB } from 'idb'
import type { Provider, RouteCatalog, RouteDetails, Snapshot } from '../types/transit'

interface BusDB extends DBSchema {
    snapshots: { key: Provider; value: Snapshot }
    responses: { key: string; value: { at: number; generation: number; data: unknown } }
    generations: { key: Provider; value: number }
    routeCatalogs: { key: Provider; value: RouteCatalog }
    routeDetails: { key: string; value: RouteDetails }
}

export function db() {
    const opening = openDB<BusDB>('bus-coming-v1', 2, {
        upgrade(database, oldVersion) {
            if (oldVersion < 1) {
                database.createObjectStore('snapshots', { keyPath: 'provider' })
                database.createObjectStore('responses')
                database.createObjectStore('generations')
            }
            if (oldVersion < 2) {
                database.createObjectStore('routeCatalogs', { keyPath: 'provider' })
                database.createObjectStore('routeDetails', { keyPath: 'id' })
            }
        },
        blocking() {
            void opening.then((database) => database.close())
        },
    })
    return opening
}
