import { db } from '../../storage/catalogDb'
import { type CatalogEvent, type Progress, type Provider, WEEK } from '../../types/transit'
import { makeSnapshot } from '../../utils/transit'
import { BASE, request } from '../api'
import { downloadCitybus } from './citybus'
import { downloadKMB } from './kmb'
import { downloadNLB } from './nlb'
import type { Row } from './shared'

export async function download(
    provider: Provider,
    force: boolean,
    emit: (message: CatalogEvent) => void,
) {
    const progress = (
        provider: Provider,
        done: number,
        total: number,
        state: Progress['state'] = 'downloading',
    ) => emit({ type: 'progress', progress: { provider, done, total, state } })
    const database = await db()
    try {
        const previous = await database.get('snapshots', provider)
        if (!force && previous && Date.now() - previous.updatedAt < WEEK) return
        let generation = await database.get('generations', provider)
        if (
            !generation ||
            (previous && generation <= previous.updatedAt) ||
            Date.now() - generation > WEEK
        ) {
            generation = Date.now()
            await database.put('generations', generation, provider)
        }
        const currentGeneration = generation
        let done = 0,
            total = provider === 'KMB' ? 3 : 1
        progress(provider, done, total)

        async function get(path: string): Promise<{ data: Row[]; routes: Row[]; stops: Row[] }> {
            const url = `${BASE[provider]}${path}`
            const cached = await database.get('responses', url)
            let data: unknown
            if (cached && cached.generation === currentGeneration) data = cached.data
            else {
                data = await request(url)
                await database.put(
                    'responses',
                    { at: Date.now(), generation: currentGeneration, data },
                    url,
                )
            }
            progress(provider, ++done, total)
            return data as { data: Row[]; routes: Row[]; stops: Row[] }
        }

        const client = {
            get,
            addTotal: (count: number) => {
                total += count
            },
        }
        const { routes, stops } =
            provider === 'KMB'
                ? await downloadKMB(client)
                : provider === 'NLB'
                  ? await downloadNLB(client)
                  : await downloadCitybus(client, async (catalog) => {
                        await database.put('routeCatalogs', catalog)
                        emit({ type: 'catalog', catalog })
                    })
        if (!routes.length || !Object.keys(stops).length) throw new Error('Empty catalogue')
        const snapshot = makeSnapshot(provider, routes, stops)
        await database.put('snapshots', snapshot)
        // The committed snapshot replaces this generation's raw checkpoint data.
        const tx = database.transaction('responses', 'readwrite')
        let cursor = await tx.store.openCursor()
        while (cursor) {
            if (cursor.key.startsWith(BASE[provider])) await cursor.delete()
            cursor = await cursor.continue()
        }
        await tx.done
        emit({ type: 'snapshot', snapshot })
        progress(provider, done, total, 'ready')
    } finally {
        database.close()
    }
}
