import type { Localized } from '../../types/transit'

export interface TimetableStop {
    id: string
    name: Localized
    lat: number
    lng: number
}

export interface ServiceCalendar {
    id: string
    days: number[]
    start: string
    end: string
    exceptions: Record<string, boolean>
}

export interface DeparturePeriod {
    calendar: string
    start: number
    end: number
    headway: number
}

export interface RouteVariant {
    id: string
    number: string
    name: Localized
    stops: string[]
    departures: DeparturePeriod[]
}

export interface VariantCatalog {
    schema: 1
    updatedAt: number
    variants: RouteVariant[]
    stops: Record<string, TimetableStop>
    calendars: Record<string, ServiceCalendar>
}
