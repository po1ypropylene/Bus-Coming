import { expect, it } from 'vitest'
import { upcomingArrivals } from './arrivals'
import type { Arrival } from '../types/transit'

const now = 1_000_000
const eta = (minutes: number, remark = ''): Arrival => ({ time: now + minutes * 60000, remark })
it('sorts the reported 13, 2, 7 minute order chronologically without mutating the response', () => {
    const input = [eta(13, 'Variant A'), eta(2, 'Variant B'), eta(7, 'Variant C')]
    expect(upcomingArrivals(input, now)).toEqual([input[1], input[2], input[0]])
    expect(input.map((a) => a.remark)).toEqual(['Variant A', 'Variant B', 'Variant C'])
})
it('sorts before taking three predictions and puts untimed remarks after timed arrivals', () => {
    const input = [{ time: null, remark: 'No service' }, eta(13), eta(7), eta(2), eta(1)]
    expect(upcomingArrivals(input, now)).toEqual([eta(1), eta(2), eta(7)])
    expect(upcomingArrivals([input[0], eta(2)], now)).toEqual([eta(2), input[0]])
})
it('keeps equal-time buses and their remarks, filters expired arrivals, and retains due buses', () => {
    const input = [eta(-2), eta(2, 'KMB'), eta(2, 'Citybus'), eta(0)]
    expect(upcomingArrivals(input, now)).toEqual([input[3], input[1], input[2]])
    expect(upcomingArrivals([], now)).toEqual([])
})
