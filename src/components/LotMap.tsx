import { useCallback, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { community, type Lot } from '../data/lots'

const LIBRARIES: ('marker')[] = []

export function useGoogleMaps() {
  return useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: LIBRARIES,
  })
}

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
]

function statusPinColor(status: Lot['status']): string {
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

interface LotMapProps {
  lots: Lot[]
  selectedLotId?: string | null
  onSelectLot?: (id: string) => void
  height?: string
  center?: { lat: number; lng: number }
  zoom?: number
  tilt?: boolean
}

export default function LotMap({
  lots,
  selectedLotId = null,
  onSelectLot,
  height = '560px',
  center = community.center,
  zoom = community.defaultZoom,
  tilt = true,
}: LotMapProps) {
  const { isLoaded, loadError } = useGoogleMaps()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const mappableLots = useMemo(() => lots.filter((l) => l.coordinates), [lots])

  const handleLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

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
          styles: DARK_STYLES,
        }}
      >
        {mappableLots.map((lot) => {
          const color = statusPinColor(lot.status)
          const active = selectedLotId === lot.id || hovered === lot.id
          return (
            <Marker
              key={lot.id}
              position={lot.coordinates!}
              onClick={() => onSelectLot?.(lot.id)}
              onMouseOver={() => setHovered(lot.id)}
              onMouseOut={() => setHovered(null)}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: active ? 12 : 9,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              label={{
                text: lot.id,
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '600',
              }}
              title={lot.title}
            />
          )
        })}
      </GoogleMap>

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
    </div>
  )
}
