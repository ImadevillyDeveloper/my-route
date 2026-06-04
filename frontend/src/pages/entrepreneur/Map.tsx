import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVehiclesMap, getDrivers } from '../../api/client'
import { getRoutesWithOverrides } from '../../api/routes'
import StatusBar from '../../components/common/StatusBar'
import LogoLoader from '../../components/common/LogoLoader'

declare global { interface Window { ymaps: any } }

const FAV_ROUTE_KEY = 'ent_favorite_route'

// Реальные остановки маршрута 212 Омск (СТЦ Мега → пос. Чкаловский)
const ROUTE_212_STOPS: { name: string; lat: number; lng: number }[] = [
  { name: 'СТЦ "Мега"',               lat: 54.9719, lng: 73.2857 },
  { name: 'Садовая',                   lat: 54.9725, lng: 73.2940 },
  { name: 'ЖК "Кристалл"',            lat: 54.9731, lng: 73.3010 },
  { name: 'Поворотная',               lat: 54.9738, lng: 73.3080 },
  { name: 'Ул. Дмитриева',            lat: 54.9752, lng: 73.3200 },
  { name: '11-й микрорайон',           lat: 54.9760, lng: 73.3270 },
  { name: 'Ул. 3-я Енисейская',       lat: 54.9775, lng: 73.3390 },
  { name: 'Библиотека им. Пушкина',   lat: 54.9837, lng: 73.3450 },
  { name: 'КДЦ "Маяковский"',         lat: 54.9851, lng: 73.3510 },
  { name: 'Главпочтамт',              lat: 54.9891, lng: 73.3672 },
  { name: 'Госпиталь',                lat: 54.9896, lng: 73.3720 },
  { name: 'Театральная площадь',      lat: 54.9891, lng: 73.3780 },
  { name: 'Ул. Декабристов',          lat: 54.9882, lng: 73.3830 },
  { name: 'Городской музей',          lat: 54.9871, lng: 73.3880 },
  { name: 'Ул. 6-я Линия',            lat: 54.9855, lng: 73.3940 },
  { name: 'Ул. 9-я Линия',            lat: 54.9840, lng: 73.4000 },
  { name: 'Ул. 16-я Линия',           lat: 54.9820, lng: 73.4070 },
  { name: 'Ул. 20-я Линия',           lat: 54.9808, lng: 73.4120 },
  { name: 'Ул. 25-я Линия',           lat: 54.9796, lng: 73.4170 },
  { name: 'Завод им. Попова',          lat: 54.9790, lng: 73.4220 },
  { name: 'Трамвайное кольцо',        lat: 54.9785, lng: 73.4270 },
  { name: 'Ул. Красных Зорь',         lat: 54.9782, lng: 73.4310 },
  { name: 'ПО "Автоматика"',          lat: 54.9778, lng: 73.4450 },
  { name: 'Ул. Петра Осминина',       lat: 54.9778, lng: 73.4480 },
  { name: 'Ул. 75-й Гв. бригады',     lat: 54.9778, lng: 73.4510 },
  { name: 'Поликлиника',              lat: 54.9778, lng: 73.4545 },
  { name: 'Ул. 50 лет ВЛКСМ',         lat: 54.9779, lng: 73.4600 },
  { name: 'Ул. Романенко',            lat: 54.9779, lng: 73.4650 },
  { name: 'Пос. Чкаловский',          lat: 54.9779, lng: 73.4704 },
]

// Реальные остановки маршрута 59 Омск (пос. Биофабрика → Омский НПЗ)
const ROUTE_59_STOPS: { name: string; lat: number; lng: number }[] = [
  { name: 'Пос. Биофабрика',          lat: 54.9941, lng: 73.4525 },
  { name: 'Центр Пенаты',             lat: 54.9921, lng: 73.4410 },
  { name: 'РЕЛЕРО',                   lat: 54.9910, lng: 73.4350 },
  { name: 'Ул. 25-я Линия',           lat: 54.9890, lng: 73.4250 },
  { name: 'Ул. 20-я Линия',           lat: 54.9874, lng: 73.4140 },
  { name: 'Ул. 17-я Линия',           lat: 54.9860, lng: 73.4080 },
  { name: 'Ул. 14-я Линия',           lat: 54.9845, lng: 73.4010 },
  { name: 'Ул. 8-я Линия',            lat: 54.9830, lng: 73.3930 },
  { name: 'Ул. 4-я Линия',            lat: 54.9818, lng: 73.3860 },
  { name: 'Школа №65',                lat: 54.9820, lng: 73.3800 },
  { name: 'Ул. Куйбышева',            lat: 54.9855, lng: 73.3750 },
  { name: 'Декабристов',              lat: 54.9880, lng: 73.3820 },
  { name: 'Театральная площадь',      lat: 54.9891, lng: 73.3780 },
  { name: 'Дом Туриста',              lat: 54.9898, lng: 73.3760 },
  { name: 'Госпиталь',                lat: 54.9896, lng: 73.3720 },
  { name: 'Главпочтамт',              lat: 54.9891, lng: 73.3672 },
  { name: 'КДЦ "Маяковский"',         lat: 54.9851, lng: 73.3510 },
  { name: 'Библиотека им. Пушкина',   lat: 54.9837, lng: 73.3450 },
  { name: 'Ул. Рабиновича',           lat: 54.9950, lng: 73.3480 },
  { name: 'Сибзавод',                 lat: 55.0050, lng: 73.3350 },
  { name: 'Городок Водников',         lat: 55.0130, lng: 73.3250 },
  { name: 'Старозагородная Роща',     lat: 55.0200, lng: 73.3150 },
  { name: 'Дворец творчества',        lat: 55.0260, lng: 73.3050 },
  { name: 'Аграрный университет',     lat: 55.0320, lng: 73.2960 },
  { name: 'Телецентр',                lat: 55.0380, lng: 73.2870 },
  { name: 'СибАДИ',                   lat: 55.0430, lng: 73.2800 },
  { name: 'Медицинская академия',     lat: 55.0470, lng: 73.2760 },
  { name: 'Технический университет',  lat: 55.0500, lng: 73.2730 },
  { name: 'ДК Химик',                 lat: 55.0560, lng: 73.2640 },
  { name: 'ДК Звёздный',              lat: 55.0590, lng: 73.2550 },
  { name: 'Пл. Лицкевича',            lat: 55.0605, lng: 73.2515 },
  { name: 'ПАТП-7',                   lat: 55.0610, lng: 73.2505 },
  { name: 'Поликлиника (пр. Губкина)',lat: 55.0613, lng: 73.2502 },
  { name: 'Омский НПЗ',               lat: 55.0615, lng: 73.2500 },
]

const ROUTE_STOPS: Record<string, { name: string; lat: number; lng: number }[]> = {
  '212': ROUTE_212_STOPS,
  '59':  ROUTE_59_STOPS,
}

const getRouteStops = (routeNumber: string | null) =>
  ROUTE_STOPS[routeNumber ?? ''] ?? ROUTE_212_STOPS

const getCurrentStop = (id: number, routeNumber: string | null) => {
  const stops = getRouteStops(routeNumber)
  return stops[(id * 3) % stops.length].name
}

// "Иванов Сергей Александрович" → "Иванов С.А.",  "Иванов С.А." → без изменений
const abbreviateName = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  // Already abbreviated if all parts after first are initials like "С." or "С.А."
  const alreadyShort = parts.slice(1).every(p => /^[А-ЯЁA-Z]\.$/.test(p) || /^[А-ЯЁA-Z]\.[А-ЯЁA-Z]\.$/.test(p))
  if (alreadyShort) return name
  const initials = parts.slice(1).map(p => p[0]?.toUpperCase() + '.').join('')
  return `${parts[0]} ${initials}`
}

const getDeparture = (id: number) => {
  const h = 7 + (id % 5)
  const m = (id * 13) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}


// ── Types ─────────────────────────────────────────────────────────
interface RouteInfo { number: string; name: string; start_point: string; end_point: string }
interface VehicleItem { id: number; plate_number: string; route_number: string | null; status: string; lat?: number; lng?: number }

// ── Main ──────────────────────────────────────────────────────────
export default function EntMap() {
  const [allVehicles, setAllVehicles] = useState<VehicleItem[]>([])
  const [allDrivers, setAllDrivers] = useState<any[]>([])
  const [routes, setRoutes] = useState<RouteInfo[]>([])
  const [favoriteRoute, setFavoriteRoute] = useState<string>(() => localStorage.getItem(FAV_ROUTE_KEY) ?? '')
  const [showPanel, setShowPanel] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleItem | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const ymapRef = useRef<any>(null)
  const vehiclesRef = useRef<VehicleItem[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const sync = () => setFavoriteRoute(localStorage.getItem(FAV_ROUTE_KEY) ?? '')
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  useEffect(() => {
    getVehiclesMap().then(r => setAllVehicles(r.data)).catch(() => {})
    getDrivers().then(r => setAllDrivers(r.data)).catch(() => {})
    const interval = setInterval(() => getVehiclesMap().then(r => setAllVehicles(r.data)).catch(() => {}), 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    getRoutesWithOverrides().then(setRoutes).catch(() => {})
  }, [])

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
      center: [54.9799, 73.3780], zoom: 12, controls: ['zoomControl'],
    })
  }, [mapReady])

  const polylineRef = useRef<any>(null)
  useEffect(() => {
    if (!ymapRef.current) return
    if (polylineRef.current) {
      ymapRef.current.geoObjects.remove(polylineRef.current)
      polylineRef.current = null
    }
    const stops = getRouteStops(favoriteRoute || null)
    if (stops.length > 1) {
      const pl = new window.ymaps.Polyline(
        stops.map(s => [s.lat, s.lng]),
        {},
        { strokeColor: '#FF6600', strokeWidth: 3, strokeOpacity: 0.55 }
      )
      ymapRef.current.geoObjects.add(pl)
      polylineRef.current = pl
      const lats = stops.map(s => s.lat)
      const lngs = stops.map(s => s.lng)
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
      ymapRef.current.setCenter([centerLat, centerLng], 12)
    }
  }, [mapReady, favoriteRoute])

  const hasDriver = (plate: string): boolean =>
    allDrivers.some((d: any) => d.plate_number === plate)

  const vehicles = allVehicles
    .filter(v => !favoriteRoute || v.route_number === favoriteRoute)
    .filter(v => hasDriver(v.plate_number))

  useEffect(() => { vehiclesRef.current = vehicles }, [vehicles])

  useEffect(() => {
    if (!ymapRef.current) return
    ymapRef.current.geoObjects.removeAll()
    vehicles.forEach(v => {
      const stops = getRouteStops(v.route_number)
      const stop = stops[(v.id * 3) % stops.length]
      const lat = v.lat ?? stop.lat
      const lng = v.lng ?? stop.lng
      const preset = v.status === 'on_route' ? 'islands#greenAutoIcon' : v.status === 'repair' ? 'islands#redAutoIcon' : 'islands#greyAutoIcon'
      const m = new window.ymaps.Placemark([lat, lng], {}, { preset })
      m.events.add('click', () => {
        const vehicle = vehiclesRef.current.find(x => x.id === v.id)
        if (vehicle) setSelectedVehicle(vehicle)
      })
      ymapRef.current.geoObjects.add(m)
    })
  }, [vehicles, mapReady])

  const favInfo = routes.find(r => r.number === favoriteRoute)
  const onLine = vehicles
  const toForward = Math.ceil(onLine.length / 2)
  const toBack = onLine.length - toForward

  const getPlate = (v: VehicleItem): string => v.plate_number

  const getDriverNameForPlate = (plate: string): string => {
    const driver = allDrivers.find((d: any) => d.plate_number === plate)
    return driver ? abbreviateName(driver.full_name) : 'Водитель'
  }

  const getDirection = (v: VehicleItem, idx: number): { forward: boolean; label: string; dot: string } => {
    const forward = idx % 2 === 0
    const dot = forward ? '#007AFF' : '#34C759'
    const label = favInfo
      ? (forward ? `${favInfo.start_point} → ${favInfo.end_point}` : `${favInfo.end_point} → ${favInfo.start_point}`)
      : `Маршрут № ${v.route_number ?? '—'}`
    return { forward, label, dot }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <StatusBar />

      {/* Header */}
      <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>Мой.Маршрут</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {favInfo ? `${favInfo.start_point} → ${favInfo.end_point}` : 'Все маршруты'}
          </div>
        </div>
        {favoriteRoute
          ? <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', color: 'white', fontWeight: 800, flexShrink: 0 }}>№ {favoriteRoute}</div>
          : <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 10px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>не выбран</div>
        }
        <button onClick={() => navigate('/entrepreneur/settings')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <LogoLoader size={72} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загрузка карты...</span>
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!favoriteRoute && mapReady && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: 20, padding: '8px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Выберите избранный маршрут в настройках
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '12px 16px', paddingBottom: 'calc(12px + var(--nav-height))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ТС на линии:</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--orange)' }}>{onLine.length}</span>
            </div>
            {favInfo ? (
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {favInfo.end_point} <strong style={{ color: 'var(--text-primary)' }}>{toForward}</strong></span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {favInfo.start_point} <strong style={{ color: 'var(--text-primary)' }}>{toBack}</strong></span>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>все маршруты</span>
            )}
          </div>
          <button onClick={() => setShowPanel(true)}
            style={{ background: 'var(--orange-bg)', border: '1.5px solid var(--orange)', borderRadius: 20, padding: '8px 16px', color: 'var(--orange)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Подробнее
          </button>
        </div>
      </div>

      {/* ── Panel: Сведения о ТС ── */}
      {showPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPanel(false) }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 390, maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>

            {/* Header */}
            <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 17 }}>Сведения о ТС</span>
              <button onClick={() => setShowPanel(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1, padding: '0 4px' }}>✕</button>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto' }}>
              {vehicles.length === 0 && (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  Нет ТС{favoriteRoute ? ` на маршруте № ${favoriteRoute}` : ''}
                </div>
              )}
              {vehicles.map((v, i) => {
                const { label, dot } = getDirection(v, i)
                const plate = getPlate(v)
                const driverName = getDriverNameForPlate(v.plate_number)
                return (
                  <div key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    style={{ padding: '13px 20px', borderBottom: i < vehicles.length - 1 ? '1px solid #F5F5F5' : 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 800, color: 'var(--orange)', fontSize: 16, letterSpacing: 0.3 }}>{plate}</span>
                        <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{driverName}</span>
                      </div>
                    </div>

                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: ТС на линии ── */}
      {selectedVehicle && (() => {
        const v = selectedVehicle
        const idx = vehicles.findIndex(x => x.id === v.id)
        const { label, dot } = getDirection(v, idx)
        const plate = getPlate(v)
        const driverName = getDriverNameForPlate(v.plate_number)
        const driverObj = allDrivers.find((d: any) => d.plate_number === v.plate_number)
        const driverId = driverObj ? String(driverObj.id) : null
        const stop = getCurrentStop(v.id, v.route_number)
        const departure = getDeparture(v.id)

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedVehicle(null) }}>
            <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430, margin: '0 auto', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>

              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E0E0' }} />
              </div>

              {/* Title row */}
              <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F0F0F0' }}>
                <span style={{ fontWeight: 800, fontSize: 17 }}>ТС на линии</span>
                <button onClick={() => setSelectedVehicle(null)}
                  style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1, padding: '0 4px' }}>✕</button>
              </div>

              <div style={{ padding: '20px 20px 0' }}>

                {/* Direction + plate + driver */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontWeight: 900, fontSize: 24, color: 'var(--orange)', letterSpacing: 0.5, marginBottom: 2 }}>{plate}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{driverName}</div>
                  </div>
                </div>

                {/* Info rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#F8F8F8', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid #EEEEEE' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Текущее местоположение</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{stop}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Время выезда</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{departure}</div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, paddingBottom: 20 }}>
                  <button
                    onClick={() => { setSelectedVehicle(null); setShowPanel(false); navigate(`/entrepreneur/vehicles/${v.id}`) }}
                    style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: '2px solid var(--orange)', background: 'white', color: 'var(--orange)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <img src="/bus.png" width="16" height="16" />
                    Карточка ТС
                  </button>
                  <button
                    onClick={() => {
                      setSelectedVehicle(null); setShowPanel(false)
                      if (driverId) navigate(`/entrepreneur/drivers/${driverId}`)
                    }}
                    disabled={!driverId}
                    style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: 'none', background: driverId ? 'var(--orange)' : '#E0E0E0', color: 'white', fontWeight: 700, fontSize: 14, cursor: driverId ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Водитель
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
