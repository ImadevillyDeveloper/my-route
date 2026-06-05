import { useEffect, useRef, useState, useCallback } from 'react'
import { getRivalsLive, requestRecommendation, getMe } from '../../api/client'
import StatusBar from '../../components/common/StatusBar'
import LogoLoader from '../../components/common/LogoLoader'

declare global { interface Window { ymaps: any } }

const RIVAL_ROUTES_KEY = 'driver_rival_routes'
const OMSK_LAT = 54.9885
const OMSK_LNG = 73.3242

// Yandex Maps color presets for different routes (deterministic by route string hash)
const ROUTE_PRESETS = [
  'islands#blueCircleDotIcon',
  'islands#redCircleDotIcon',
  'islands#violetCircleDotIcon',
  'islands#darkblueCircleDotIcon',
  'islands#greenCircleDotIcon',
  'islands#pinkCircleDotIcon',
  'islands#darkgreenCircleDotIcon',
  'islands#yellowCircleDotIcon',
]
function routePreset(route: string): string {
  const hash = route.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ROUTE_PRESETS[hash % ROUTE_PRESETS.length]
}

interface Pos { lat: number; lng: number; speed: number }
interface RivalInfo {
  route: string; model: string; plate: string
  speed: number; direction: string; minutes: number
}
interface MarkerEntry {
  marker: any
  lat: number
  lng: number
  animFrames: number[]  // requestAnimationFrame ids
}

const ANIM_DURATION_MS = 8000  // spread movement over 8 s (< 10 s poll interval)

export default function DriverMap() {
  const [position, setPosition]     = useState<Pos | null>(null)
  const [geoError, setGeoError]     = useState<string | null>(null)
  const [rivals, setRivals]         = useState<any[]>([])
  const [hint, setHint]             = useState<{ message: string; speed: number } | null>(null)
  const [mapReady, setMapReady]     = useState(false)
  const [voiceOn, setVoiceOn]       = useState(true)
  const [rivalInfo, setRivalInfo]   = useState<RivalInfo | null>(null)
  const [rivalRoutes, setRivalRoutes] = useState<string[]>([])
  const [liveError, setLiveError]   = useState(false)

  const mapRef          = useRef<HTMLDivElement>(null)
  const ymapRef         = useRef<any>(null)
  const myMarkerRef     = useRef<any>(null)
  const positionRef     = useRef<Pos | null>(null)
  // keyed by unit_id (or fallback string)
  const rivalMarkersRef = useRef<Map<string, MarkerEntry>>(new Map())

  const [driverRoute, setDriverRoute] = useState('—')

  useEffect(() => {
    getMe().then(r => {
      const route = r.data.route_number
      if (route) setDriverRoute(route)
    }).catch(() => {})
  }, [])

  const speak = useCallback((text: string) => {
    if (!voiceOn || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'; u.rate = 0.9
    window.speechSynthesis.speak(u)
  }, [voiceOn])

  // Sync positionRef so click handlers always get the latest driver position
  useEffect(() => { positionRef.current = position }, [position])

  // ── Расстояние по формуле Хаверсина (км) ───────────────────────
  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // ── Реальная геолокация ──────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Геолокация недоступна')
      setPosition({ lat: OMSK_LAT, lng: OMSK_LNG, speed: 0 })
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: Math.round((pos.coords.speed ?? 0) * 3.6),
        })
        setGeoError(null)
      },
      err => {
        setGeoError(err.code === 1 ? 'Нет разрешения на геолокацию' : 'Ошибка геолокации')
        if (!position) setPosition({ lat: OMSK_LAT, lng: OMSK_LNG, speed: 0 })
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Загрузка и поллинг конкурентов (10 с) ──────────────────────
  const loadAndFetch = useCallback(async () => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(RIVAL_ROUTES_KEY) || '[]')
      setRivalRoutes(saved)
      if (saved.length === 0) { setRivals([]); return }
      const res = await getRivalsLive(saved)
      setRivals(res.data)
      setLiveError(false)
    } catch {
      setLiveError(true)
    }
  }, [])

  useEffect(() => {
    loadAndFetch()
    const t = setInterval(loadAndFetch, 10000)
    return () => clearInterval(t)
  }, [loadAndFetch])

  useEffect(() => {
    window.addEventListener('focus', loadAndFetch)
    window.addEventListener('rival-routes-changed', loadAndFetch)
    return () => {
      window.removeEventListener('focus', loadAndFetch)
      window.removeEventListener('rival-routes-changed', loadAndFetch)
    }
  }, [loadAndFetch])

  // ── Инициализация карты ─────────────────────────────────────────
  useEffect(() => {
    if (document.querySelector('script[src*="api-maps.yandex"]')) {
      if (window.ymaps) window.ymaps.ready(() => setMapReady(true))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://api-maps.yandex.ru/2.1/?apikey=&lang=ru_RU'
    s.async = true
    s.onload = () => window.ymaps.ready(() => setMapReady(true))
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || ymapRef.current) return
    ymapRef.current = new window.ymaps.Map(mapRef.current, {
      center: [OMSK_LAT, OMSK_LNG], zoom: 14, controls: ['zoomControl'],
    })
    setTimeout(() => ymapRef.current?.container?.fitToViewport(), 50)
  }, [mapReady])

  useEffect(() => {
    const handleResize = () => { if (ymapRef.current) ymapRef.current.container.fitToViewport() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Метка водителя ───────────────────────────────────────────────
  useEffect(() => {
    if (!ymapRef.current || !mapReady || !position) return
    if (myMarkerRef.current) ymapRef.current.geoObjects.remove(myMarkerRef.current)
    const me = new window.ymaps.Placemark(
      [position.lat, position.lng],
      { balloonContent: `Моя позиция · ${position.speed} км/ч` },
      { preset: 'islands#orangeAutoIcon' }
    )
    ymapRef.current.geoObjects.add(me)
    myMarkerRef.current = me
    ymapRef.current.setCenter([position.lat, position.lng])
  }, [position, mapReady])

  // ── Плавное обновление маркеров конкурентов ─────────────────────
  useEffect(() => {
    if (!ymapRef.current || !mapReady) return

    const ymap = ymapRef.current
    const markersMap = rivalMarkersRef.current

    // Build a set of current unit IDs from new data
    const incoming = new Map<string, any>()
    rivals.forEach((r, i) => {
      const key = r.unit_id ? String(r.unit_id) : `fallback-${i}`
      incoming.set(key, r)
    })

    // Remove markers for units that are no longer present
    for (const [key, entry] of markersMap) {
      if (!incoming.has(key)) {
        entry.animFrames.forEach(id => cancelAnimationFrame(id))
        try { ymap.geoObjects.remove(entry.marker) } catch {}
        markersMap.delete(key)
      }
    }

    // Update or add markers for current units
    for (const [key, r] of incoming) {
      const lat = parseFloat(String(r.lat ?? 0))
      const lng = parseFloat(String(r.lng ?? 0))
      if (!lat || !lng) continue

      const plate    = r.plate_number || '—'
      const model    = r.model        || 'Автобус'
      const speed    = Math.round(parseFloat(String(r.speed ?? 0)))
      const routeNum = String(r.route_number ?? '—')
      const balloonContent = [
        `<b>Маршрут №${routeNum}</b>`,
        r.direction ? `<span style="color:#888">${r.direction}</span>` : '',
        model !== 'Автобус' ? `Модель: <b>${model}</b>` : '',
        plate !== '—' ? `Гос. номер: <b>${plate}</b>` : '',
        `Скорость: <b>${speed} км/ч</b>`,
      ].filter(Boolean).join('<br/>')

      const preset = routePreset(routeNum)

      if (markersMap.has(key)) {
        const entry = markersMap.get(key)!
        const fromLat = entry.lat
        const fromLng = entry.lng

        entry.animFrames.forEach(id => cancelAnimationFrame(id))
        entry.animFrames = []

        if (fromLat !== lat || fromLng !== lng) {
          const startTime = performance.now()
          const animate = (now: number) => {
            const elapsed = now - startTime
            const t = Math.min(elapsed / ANIM_DURATION_MS, 1)
            const curLat = fromLat + (lat - fromLat) * t
            const curLng = fromLng + (lng - fromLng) * t
            try { entry.marker.geometry.setCoordinates([curLat, curLng]) } catch {}
            if (t < 1) {
              const frameId = requestAnimationFrame(animate)
              entry.animFrames.push(frameId)
            }
          }
          const frameId = requestAnimationFrame(animate)
          entry.animFrames.push(frameId)
        }

        entry.lat = lat
        entry.lng = lng
        try { entry.marker.properties.set('balloonContent', balloonContent) } catch {}
      } else {
        // Capture stable values for the click handler closure
        const capturedPlate  = plate
        const capturedModel  = model
        const capturedSpeed  = speed
        const capturedDir    = String(r.direction ?? '—')
        const capturedRoute  = routeNum
        const capturedLat    = lat
        const capturedLng    = lng

        const marker = new window.ymaps.Placemark(
          [lat, lng],
          { balloonContent, hintContent: `№${routeNum}` },
          { preset }
        )
        marker.events.add('click', () => {
          // Calculate real distance to competitor at click time
          const pos = positionRef.current
          const dist = pos ? haversineKm(pos.lat, pos.lng, capturedLat, capturedLng) : 1
          const avgSpeed = Math.max(10, (capturedSpeed + (pos?.speed ?? 30)) / 2)
          const minutes = Math.max(1, Math.round(dist / avgSpeed * 60))
          setRivalInfo({
            route:     capturedRoute,
            model:     capturedModel,
            plate:     capturedPlate,
            speed:     capturedSpeed,
            direction: capturedDir,
            minutes,
          })
        })
        ymap.geoObjects.add(marker)
        markersMap.set(key, { marker, lat, lng, animFrames: [] })
      }
    }
  }, [rivals, mapReady])

  // ── Cleanup анимаций при размонтировании ─────────────────────────
  useEffect(() => {
    return () => {
      rivalMarkersRef.current.forEach(entry => {
        entry.animFrames.forEach(id => cancelAnimationFrame(id))
      })
    }
  }, [])

  const askAI = async () => {
    try {
      const res = await requestRecommendation(`Маршрут №${driverRoute}`)
      setHint(res.data)
      speak(res.data.message)
    } catch {}
  }

  return (
    <div className="map-page-root" style={{ display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <StatusBar />

      <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>Мой.Маршрут</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 1 }}>
            {geoError ?? (rivalRoutes.length > 0
              ? `Конкуренты: №${rivalRoutes.slice(0, 3).join(', №')}${rivalRoutes.length > 3 ? '…' : ''}`
              : 'Маршрут №' + driverRoute)}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', color: 'white', fontWeight: 800, fontSize: 15 }}>
          №{driverRoute}
        </div>
        <button onClick={() => setVoiceOn(v => !v)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 16 }}>
          {voiceOn ? '🔊' : '🔇'}
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8E8E8', flexDirection: 'column', gap: 12 }}>
            <LogoLoader size={72} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загрузка карты...</span>
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {position && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'white', borderRadius: 12, padding: '8px 12px', boxShadow: 'var(--shadow-md)', textAlign: 'center', minWidth: 52 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--orange)', lineHeight: 1 }}>{position.speed}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>КМ/Ч</div>
          </div>
        )}

        {rivalRoutes.length > 0 && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: liveError ? '#FFF0EF' : '#EDFAF1', borderRadius: 10, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: liveError ? '#FF3B30' : '#34C759' }}>
            {liveError ? '⚠ Нет связи' : `● LIVE · ${rivals.length} ТС`}
          </div>
        )}

        {rivalRoutes.length === 0 && mapReady && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: 20, padding: '8px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Выберите конкурентов в Настройках
          </div>
        )}
      </div>

      <div className="map-info-bar" style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '12px 14px', paddingBottom: 'calc(12px + var(--nav-safe))' }}>
        {hint ? (
          <div style={{ background: 'var(--orange-bg)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{hint.message}</span>
            <button onClick={() => setHint(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>✕</button>
          </div>
        ) : rivals.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
              Конкурентов на маршрутах: <strong>{rivals.length}</strong>
            </span>
            <button className="btn btn-primary" onClick={askAI} style={{ width: 'auto', padding: '8px 16px', fontSize: 13, borderRadius: 20 }}>
              ⚡ Совет
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={askAI} style={{ borderRadius: 12 }}>
            ⚡ Получить ИИ-подсказку
          </button>
        )}
      </div>

      {rivalInfo && (
        <div onClick={() => setRivalInfo(null)}
          className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 20, padding: '20px 24px', width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 17 }}>Конкурент №{rivalInfo.route}</span>
              <button onClick={() => setRivalInfo(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            {[
              { label: 'Маршрут:',          value: rivalInfo.route },
              { label: 'Модель:',            value: rivalInfo.model },
              { label: 'Гос. номер:',        value: rivalInfo.plate },
              { label: 'Скорость:',          value: `${rivalInfo.speed} км/ч` },
              { label: 'Направление:',       value: rivalInfo.direction },
              { label: 'Опережает вас на:',  value: `~${rivalInfo.minutes} мин`, color: '#34C759' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F0F0F0' }}>
                <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--orange)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
