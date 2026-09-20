/// <reference lib="webworker" />
import { download } from '../services/catalog/download'
import { PROVIDERS } from '../types/transit'

let busy = false
self.onmessage = async (event: MessageEvent<{ force: boolean }>) => {
    if (busy) return
    busy = true
    await Promise.all(
        PROVIDERS.map(async (provider) => {
            try {
                await download(provider, event.data.force, (message) => self.postMessage(message))
            } catch (error) {
                console.error(`Catalogue download failed: ${provider}`, error)
                self.postMessage({
                    type: 'progress',
                    progress: { provider, done: 0, total: 0, state: 'error' },
                })
            }
        }),
    )
    busy = false
    self.postMessage({ type: 'complete' })
}
