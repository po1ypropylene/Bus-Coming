import { db } from '../../storage/catalogDb'
import { type CatalogEvent, type JointCatalog, WEEK } from '../../types/transit'
import { request } from '../api'

export const JOINT_CACHE_KEY = 'td-joint-routes-v1'
export const JOINT_ENDPOINT =
    'https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/FeatureServer/0/query'

export function parseJointPage(input: unknown): {
    numbers: string[]
    more: boolean
    count: number
} {
    const page = input as {
        error?: unknown
        exceededTransferLimit?: boolean
        features?: { attributes?: { COMPANY_CODE?: string; ROUTE_NAMEE?: string } }[]
    }
    if (!page || page.error || !Array.isArray(page.features)) throw new Error('Invalid TD response')
    const numbers = page.features.map(({ attributes: a }) => {
        if (
            !a ||
            !['KMB+CTB', 'LWB+CTB'].includes(a.COMPANY_CODE ?? '') ||
            !/^[A-Z0-9]+$/.test(a.ROUTE_NAMEE ?? '')
        )
            throw new Error('Invalid TD joint route')
        return a.ROUTE_NAMEE!
    })
    return { numbers, more: page.exceededTransferLimit === true, count: numbers.length }
}

export function cachedJointCatalog(value: unknown): JointCatalog | null {
    const catalog = value as JointCatalog
    return catalog &&
    Number.isFinite(catalog.updatedAt) &&
    Array.isArray(catalog.numbers) &&
    catalog.numbers.length > 0 &&
    catalog.numbers.every((n) => typeof n === 'string' && /^[A-Z0-9]+$/.test(n))
        ? catalog
        : null
}

export async function downloadJointCatalog(force: boolean, emit: (event: CatalogEvent) => void) {
    const database = await db()
    try {
        const cached = cachedJointCatalog((await database.get('responses', JOINT_CACHE_KEY))?.data)
        if (cached) emit({ type: 'joint', catalog: cached })
        if (cached && !force && Date.now() - cached.updatedAt < WEEK) return
        const numbers = new Set<string>()
        let offset = 0
        for (; ;) {
            const params = new URLSearchParams({
                f: 'json',
                where: "COMPANY_CODE IN ('KMB+CTB','LWB+CTB')",
                outFields: 'OBJECTID,COMPANY_CODE,ROUTE_NAMEE',
                returnGeometry: 'false',
                orderByFields: 'OBJECTID',
                resultOffset: String(offset),
                resultRecordCount: '1000',
            })
            const page = parseJointPage(await request(`${JOINT_ENDPOINT}?${params}`))
            page.numbers.forEach((number) => numbers.add(number))
            offset += page.count
            if (!page.more) break
            if (!page.count || offset > 10000) throw new Error('Incomplete TD pagination')
        }
        if (!numbers.size) throw new Error('Empty TD joint-route catalogue')
        const catalog = { updatedAt: Date.now(), numbers: [...numbers].sort() }
        await database.put(
            'responses',
            { at: catalog.updatedAt, generation: 1, data: catalog },
            JOINT_CACHE_KEY,
        )
        emit({ type: 'joint', catalog })
    } finally {
        database.close()
    }
}
