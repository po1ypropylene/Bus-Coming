import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { requestJson } from './http'

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T08:00:00+08:00'))
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

it.each([400, 403, 404])('does not retry permanent HTTP %s errors', async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status }))
    vi.stubGlobal('fetch', fetch)
    await expect(requestJson('https://example.test/data')).rejects.toThrow(`HTTP ${status}`)
    expect(fetch).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
})

it('retries transient errors once per delay and honours numeric Retry-After', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '5' } }))
        .mockResolvedValueOnce(Response.json({ data: [] }))
    vi.stubGlobal('fetch', fetch)
    const work = requestJson('https://example.test/data')
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4999)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await expect(work).resolves.toEqual({ data: [] })
    expect(fetch).toHaveBeenCalledTimes(3)
})

it.each([
    ['invalid date', 1000],
    [new Date('2026-11-12T08:00:08+08:00').toUTCString(), 8000],
    [new Date('2026-11-12T08:02:00+08:00').toUTCString(), 15000],
])('bounds HTTP-date and invalid Retry-After delays: %s', async (header, delay) => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(
            new Response(null, { status: 429, headers: { 'Retry-After': header } }),
        )
        .mockResolvedValueOnce(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetch)
    const work = requestJson('https://example.test/data')
    await vi.advanceTimersByTimeAsync(delay - 1)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    await expect(work).resolves.toEqual({ ok: true })
})

it('stops after the final transient error without another sleep', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const failure = expect(requestJson('https://example.test/data')).rejects.toThrow('HTTP 503')
    await vi.runAllTimersAsync()
    await failure
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(Date.now()).toBe(Date.parse('2026-11-12T08:00:03+08:00'))
    expect(vi.getTimerCount()).toBe(0)
})

it('retries network failures and permits the publisher retry budget', async () => {
    const fetch = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Network unavailable'))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetch)
    const work = requestJson('https://example.test/data', {
        attempts: 5,
        timeout: 30000,
        maxRetryDelay: 60000,
    })
    await vi.runAllTimersAsync()
    await expect(work).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(5)
})
