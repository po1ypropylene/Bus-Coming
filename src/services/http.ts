interface RequestOptions {
    attempts?: number
    timeout?: number
    maxRetryDelay?: number
}

export async function requestJson(url: string, options: RequestOptions = {}): Promise<unknown> {
    const { attempts = 3, timeout = 25000, maxRetryDelay = 15000 } = options
    for (let attempt = 0; attempt < attempts; attempt++) {
        const backoff = 1000 * 2 ** attempt
        let response: Response
        try {
            response = await fetch(url, {
                signal: AbortSignal.timeout(timeout),
                cache: 'no-store',
            })
            if (response.ok) return await response.json()
        } catch (error) {
            if (attempt === attempts - 1) throw error
            await new Promise((resolve) => setTimeout(resolve, Math.min(maxRetryDelay, backoff)))
            continue
        }
        // A permanent HTTP error cannot recover through repeated identical requests.
        if ((response.status !== 429 && response.status < 500) || attempt === attempts - 1)
            throw new Error(`HTTP ${response.status}`)
        const header = response.headers.get('Retry-After')
        const seconds = header === null ? NaN : Number(header)
        const retryAfter = Number.isFinite(seconds)
            ? seconds * 1000
            : Date.parse(header ?? '') - Date.now()
        const delay = Math.min(maxRetryDelay, Math.max(backoff, retryAfter || 0))
        await new Promise((resolve) => setTimeout(resolve, delay))
    }
    throw new Error('Network unavailable')
}
