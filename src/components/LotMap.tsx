import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { trpc } from '@/providers/trpc'
import { community } from '../data/lots'

export type StadiumStatus = 'Available' | 'Under Contract' | 'Sold' | 'Coming Soon'

export interface StadiumLotFeature {
  type: 'Feature'
  geometry: { type: 'Polygon'; coordinates: number[][][] } | null
  properties: {
    name: string
    status: StadiumStatus
    grooveStatus: string
    price: number | null
    acreage: number | null
    facing: string | null
    phase: string
    label: [number, number] | null
    features: string[]
  }
}

export function useGoogleMaps() {
  return useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
  })
}

export function statusPinColor(status: StadiumStatus): string {
  switch (status) {
    case 'Available':
      return '#1a6b3a'
    case 'Under Contract':
      return '#8a5a00'
    case 'Sold':
      return '#8a1a1a'
    case 'Coming Soon':
      return '#1a4a8a'
  }
}

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
]

interface StadiumLotMapProps {
  onSelectLot?: (name: string) => void
  selectedLotName?: string | null
  height?: string
  center?: { lat: number; lng: number }
  zoom?: number
  tilt?: boolean
  filterLot?: (f: StadiumLotFeature) => boolean
  interactive?: boolean
}

let geojsonCache: StadiumLotFeature[] | null = null
let geojsonPromise: Promise<StadiumLotFeature[]> | null = null

export function loadStadiumLots(): Promise<StadiumLotFeature[]> {
  if (geojsonCache) return Promise.resolve(geojsonCache)
  if (!geojsonPromise) {
    geojsonPromise = import('../data/stadium-lots.json').then((m) => {
      geojsonCache = (m.default as unknown as { features: StadiumLotFeature[] }).features
      return geojsonCache
    })
  }
  return geojsonPromise
}

/**
 * Lot polygons + statuses, preferring the live server feed (refreshed from
 * Groove every few hours) and falling back to the baked-in snapshot so the
 * map never breaks if the upstream feed changes.
 */
export function useStadiumLots(): StadiumLotFeature[] | null {
  const [snapshot, setSnapshot] = useState<StadiumLotFeature[] | null>(null)
  useEffect(() => {
    loadStadiumLots()
      .then(setSnapshot)
      .catch(() => {})
  }, [])
  const live = trpc.lots.live.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
  const liveFeatures = live.data?.features as StadiumLotFeature[] | undefined
  return liveFeatures && liveFeatures.length > 0 ? liveFeatures : snapshot
}

export default function LotMap({
  onSelectLot,
  selectedLotName = null,
  height = '560px',
  center = community.center,
  zoom = community.defaultZoom,
  tilt = false,
  filterLot,
  interactive = true,
}: StadiumLotMapProps) {
  const { isLoaded, loadError } = useGoogleMaps()
  const mapRef = useRef<google.maps.Map | null>(null)
  const features = useStadiumLots()
  const [hovered, setHovered] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const selectedRef = useRef<string | null>(selectedLotName)

  useEffect(() => {
    selectedRef.current = selectedLotName
    restyle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLotName])

  const styleFeature = useCallback((feature: google.maps.Data.Feature): google.maps.Data.StyleOptions => {
    const status = feature.getProperty('status') as StadiumStatus
    const name = feature.getProperty('name') as string
    const color = statusPinColor(status)
    const isActive = hoveredRef.current === name || selectedRef.current === name
    return {
      fillColor: color,
      fillOpacity: isActive ? 0.55 : status === 'Available' ? 0.38 : 0.28,
      strokeColor: isActive ? '#ffffff' : color,
      strokeWeight: isActive ? 3 : 1.5,
      strokeOpacity: 0.95,
      zIndex: isActive ? 10 : 1,
      clickable: interactive,
    }
  }, [interactive])

  const restyle = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    map.data.setStyle(styleFeature)
  }, [styleFeature])

  // Load polygons once map + features are ready
  useEffect(() => {
    const map = mapRef.current
    if (!map || !features) return

    map.data.forEach((f) => map.data.remove(f))
    for (const feat of features) {
      if (!feat.geometry) continue
      if (filterLot && !filterLot(feat)) continue
      map.data.addGeoJson({ type: 'Feature', geometry: feat.geometry, properties: feat.properties })
    }
    restyle()
  }, [features, filterLot, restyle, isLoaded])

  const handleLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    if (!interactive) return
    map.data.addListener('mouseover', (e: google.maps.Data.MouseEvent) => {
      hoveredRef.current = e.feature.getProperty('name') as string
      setHovered(hoveredRef.current)
      restyle()
    })
    map.data.addListener('mouseout', () => {
      hoveredRef.current = null
      setHovered(null)
      restyle()
    })
    map.data.addListener('click', (e: google.maps.Data.MouseEvent) => {
      const name = e.feature.getProperty('name') as string
      if (name) onSelectLotRef.current?.(name)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, restyle])

  const onSelectLotRef = useRef(onSelectLot)
  useEffect(() => {
    onSelectLotRef.current = onSelectLot
  }, [onSelectLot])

  if (loadError) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0b0b',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '14px',
          letterSpacing: '0.05em',
        }}
      >
        Map unavailable — check the Google Maps API key configuration.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0b0b',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
        }}
      >
        Loading map…
      </div>
    )
  }

  const hoveredFeature = hovered && features ? features.find((f) => f.properties.name === hovered) : null

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        tilt={tilt ? 45 : 0}
        onLoad={handleLoad}
        options={{
          mapTypeId: 'hybrid',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          rotateControl: true,
          gestureHandling: 'greedy',
          scrollwheel: true,
          styles: DARK_STYLES,
        }}
      />

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: 'rgba(11,11,11,0.82)',
          border: '1px solid rgba(255,255,255,0.18)',
          padding: '14px 18px',
          display: 'grid',
          gap: '8px',
          zIndex: 2,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {(['Available', 'Under Contract', 'Sold', 'Coming Soon'] as const).map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: statusPinColor(s),
                border: '1px solid #ffffff',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredFeature && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            backgroundColor: 'rgba(11,11,11,0.88)',
            border: '1px solid rgba(255,255,255,0.22)',
            padding: '14px 18px',
            zIndex: 2,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            minWidth: '180px',
            pointerEvents: 'none',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '6px',
            }}
          >
            Lot {hoveredFeature.properties.name} · {hoveredFeature.properties.phase}
          </p>
          <p style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff', marginBottom: '4px' }}>
            {hoveredFeature.properties.price
              ? `$${hoveredFeature.properties.price.toLocaleString()}`
              : hoveredFeature.properties.grooveStatus}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
            {hoveredFeature.properties.acreage ? `${hoveredFeature.properties.acreage} acres · ` : ''}
            {hoveredFeature.properties.grooveStatus}
          </p>
        </div>
      )}
    </div>
  )
}
