import { useMemo, useState } from 'react'
import type { Stop } from '../types/transit'
import { distance } from '../utils/transit'
export function useNearbyStops(stops: Record<string, Stop>) {
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null,
  )
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const [nearStop, setNearStop] = useState<string | null>(null)
  const nearby = useMemo(
    () =>
      position
        ? Object.values(stops)
            .filter((stop) => !stop.metadataMissing)
            .map((stop) => ({ stop, meters: distance(position, stop) }))
            .filter((s) => s.meters <= 1000)
            .sort((a, b) => a.meters - b.meters)
            .slice(0, 40)
        : [],
    [position, stops],
  )
  function locate() {
    setLocating(true)
    setLocationError(false)
    if (!navigator.geolocation) {
      setLocationError(true)
      setLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        })
        setLocating(false)
      },
      () => {
        setLocationError(true)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }
  return { position, locating, locationError, nearStop, setNearStop, nearby, locate }
}
