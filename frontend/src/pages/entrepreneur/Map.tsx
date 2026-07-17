import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVehiclesMap, getDrivers, getRivalsLive, getMyVehiclesLive, getNearestStop } from '../../api/client'
import { getRoutesWithOverrides } from '../../api/routes'
import LogoLoader from '../../components/common/LogoLoader'

declare global { interface Window { ymaps: any } }

const FAV_ROUTE_KEY = 'ent_favorite_route'

const DIR_PALETTE = [
  'islands#blueCircleDotIcon',
  'islands#greenCircleDotIcon',
  'islands#violetCircleDotIcon',
  'islands#orangeCircleDotIcon',
]

const abbreviateName = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  const alreadyShort = parts.slice(1).every(p => /^[А-ЯЁA-Z]\.$/.test(p) || /^[А-ЯЁA-Z]\.[А-ЯЁA-Z]\.$/.test(p))
  if (alreadyShort) return name
  const initials = parts.slice(1).map(p => p[0]?.toUpperCase() + '.').join('')
  return `${parts[0]} ${initials}`
}

interface RouteInfo { number: string; name: string; start_point: string; end_point: string }
interface LocalVehicle { id: number; plate_number: string; route_number: string | null; status: string; lat?: number; lng?: number }
interface NavVehicle {
  id: number
  unit_id?: string
  lat: number
  lng: number
  speed: number
  direction: string
  route_number?: string
  plate_number?: string
  model?: string
  status?: string
  source?: string  // "gps" — местоположение по GPS водителя, нет данных Навитранса
}

export default function EntMap() {
  const [allVehicles, setAllVehicles]     = useState<LocalVehicle[]>([])
  const [allDrivers, setAllDrivers]       = useState<any[]>([])
  const [routes, setRoutes]               = useState<RouteInfo[]>([])
  const [favoriteRoute, setFavoriteRoute] = useState<string>(() => localStorage.getItem(FAV_ROUTE_KEY) ?? '')
  const [navVehicles, setNavVehicles]     = useState<NavVehicle[]>([])
  const [navLoaded, setNavLoaded]         = useState(false)
  const [showPanel, setShowPanel]           = useState(false)
  const [routeDropOpen, setRouteDropOpen]   = useState(false)
  const [routeDropPos, setRouteDropPos]     = useState({ top: 0, right: 0, width: 0 })
  const [selectedNav, setSelectedNav]     = useState<NavVehicle | null>(null)
  const [nearestStopName, setNearestStopName] = useState<string | null>(null)
  const [mapReady, setMapReady]           = useState(false)
  const mapRef          = useRef<HTMLDivElement>(null)
  const ymapRef         = useRef<any>(null)
  const markersRef      = useRef<any[]>([])
  const routeBadgeRef   = useRef<HTMLDivElement>(null)
  const navigate        = useNavigate()

  // Sync favorite route when window regains focus
  useEffect(() => {
    const sync = () => setFavoriteRoute(localStorage.getItem(FAV_ROUTE_KEY) ?? '')
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  useEffect(() => {
    if (!routeDropOpen) return
    const close = (e: MouseEvent) => {
      if (routeBadgeRef.current && !routeBadgeRef.current.contains(e.target as Node)) {
        setRouteDropOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [routeDropOpen])

  // Load local DB data
  useEffect(() => {
    getVehiclesMap().then(r => setAllVehicles(r.data)).catch(() => {})
    getDrivers().then(r => setAllDrivers(r.data)).catch(() => {})
    const t = setInterval(() => getVehiclesMap().then(r => setAllVehicles(r.data)).catch(() => {}), 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { getRoutesWithOverrides().then(setRoutes).catch(() => {}) }, [])

  // Живые позиции ТС: с избранным маршрутом — данные Навитранса по этому
  // маршруту; без него — ВСЕ ТС предпринимателя (Навитранс + GPS-фолбэк для
  // водителей с открытой сменой), реальные данные в обоих случаях.
  useEffect(() => {
    setNavLoaded(false)
    const fetch = () => (favoriteRoute ? getRivalsLive([favoriteRoute]) : getMyVehiclesLive())
      .then(r => { setNavVehicles(r.data); setNavLoaded(true) })
      .catch(() => { setNavLoaded(true) })
    fetch()
    const t = setInterval(fetch, 12000)
    return () => clearInterval(t)
  }, [favoriteRoute])

  // Init Yandex Maps script
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
    setTimeout(() => ymapRef.current?.container?.fitToViewport(), 50)
  }, [mapReady])

  // Яндекс.Карты сами не следят за размером своего контейнера — если он
  // меняется (например, нижний блок с "Подробнее" вырос/сжался после того,
  // как подгрузились реальные данные), карту нужно попросить пересчитаться
  // явно. ResizeObserver ловит любое такое изменение, а не только resize
  // окна — это надёжнее фиксированного таймера после инициализации.
  useEffect(() => {
    if (!mapRef.current) return
    const refit = () => { if (ymapRef.current) ymapRef.current.container.fitToViewport() }
    const ro = new ResizeObserver(refit)
    ro.observe(mapRef.current)
    window.addEventListener('resize', refit)
    return () => { ro.disconnect(); window.removeEventListener('resize', refit) }
  }, [])

  // Маркеры ТС — реальные позиции (Навитранс/ГЛОНАСС + GPS-фолбэк), без
  // придуманных полилиний маршрута: на реальной карте они всё равно не
  // совпадали с фактической трассой движения.
  useEffect(() => {
    if (!ymapRef.current) return
    markersRef.current.forEach(m => ymapRef.current.geoObjects.remove(m))
    markersRef.current = []

    // Map unique directions → stable colours (туда = blue, обратно = green, …)
    const uniqueDirsNow = [...new Set(navVehicles.map(v => v.direction || '').filter(Boolean))]
    const dirToPreset: Record<string, string> = {}
    uniqueDirsNow.forEach((d, i) => { dirToPreset[d] = DIR_PALETTE[i] ?? 'islands#greyCircleDotIcon' })

    navVehicles.forEach(v => {
      const isGps = v.source === 'gps'
      const preset = isGps ? 'islands#greyStretchyIcon' : (dirToPreset[v.direction || ''] ?? 'islands#greyCircleDotIcon')
      // hasBalloon:false — у нас своя карточка по клику (setSelectedNav), родной
      // балун Яндекс.Карт поверх неё не нужен.
      const m = new window.ymaps.Placemark(
        [v.lat, v.lng],
        { hintContent: v.plate_number || '?', iconContent: isGps ? (v.plate_number || '') : undefined },
        { preset, hasBalloon: false }
      )
      m.events.add('click', () => setSelectedNav(v))
      ymapRef.current.geoObjects.add(m)
      markersRef.current.push(m)
    })
  }, [navVehicles, mapReady])

  // Реальное ближайшее место (по данным Навитранса) для карточки выбранного ТС
  useEffect(() => {
    if (!selectedNav || !selectedNav.route_number) { setNearestStopName(null); return }
    setNearestStopName(null)
    getNearestStop(selectedNav.route_number, selectedNav.lat, selectedNav.lng)
      .then(res => setNearestStopName(res.data.name ?? null))
      .catch(() => setNearestStopName(null))
  }, [selectedNav])

  // Plate-based lookups in local DB
  const findLocalVehicle = (plate?: string | null): LocalVehicle | undefined =>
    plate ? allVehicles.find(v => v.plate_number === plate) : undefined

  const findLocalDriver = (plate?: string | null): any | undefined =>
    plate ? allDrivers.find((d: any) => d.plate_number === plate) : undefined

  const openRouteDrop = () => {
    if (routeBadgeRef.current) {
      const r = routeBadgeRef.current.getBoundingClientRect()
      setRouteDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right, width: 220 })
    }
    setRouteDropOpen(o => !o)
  }

  const selectRoute = (num: string) => {
    setFavoriteRoute(num)
    localStorage.setItem(FAV_ROUTE_KEY, num)
    setRouteDropOpen(false)
  }

  const clearRoute = () => {
    setFavoriteRoute('')
    localStorage.removeItem(FAV_ROUTE_KEY)
    setRouteDropOpen(false)
  }

  // Stats
  const favInfo = routes.find(r => r.number === favoriteRoute)

  const dirCounts: Record<string, number> = {}
  navVehicles.forEach(v => { const d = v.direction || ''; dirCounts[d] = (dirCounts[d] || 0) + 1 })
  const dirEntries = Object.entries(dirCounts).sort((a, b) => b[1] - a[1])
  const uniqueDirs = dirEntries.map(e => e[0])

  const getDotColor = (dir: string) => uniqueDirs.indexOf(dir) === 0 ? '#007AFF' : '#34C759'

  const onLineCount = navVehicles.length

  return (
    <div className="map-page-root" style={{ display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--app-vh, 100dvh)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>Мой.Маршрут</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {favInfo ? `${favInfo.start_point} → ${favInfo.end_point}` : 'Все маршруты'}
          </div>
        </div>
        <div ref={routeBadgeRef} onClick={openRouteDrop}
          style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', color: 'white', fontWeight: 800, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
          {favoriteRoute ? `№ ${favoriteRoute}` : 'маршрут'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="3">
            <polyline points={routeDropOpen ? '6 15 12 9 18 15' : '6 9 12 15 18 9'}/>
          </svg>
        </div>
        <button onClick={() => navigate('/entrepreneur/settings')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* Map */}
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
      <div className="map-info-bar" style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '12px 16px', paddingBottom: 'calc(12px + var(--nav-safe))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ТС на линии:</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--orange)' }}>{onLineCount}</span>
            </div>
            {dirEntries.length > 0 ? (
              <div style={{ display: 'flex', gap: 12 }}>
                {dirEntries.slice(0, 2).map(([dir, cnt]) => {
                  const dest = dir.split(' → ')[1] || dir
                  return <span key={dir} style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {dest} <strong style={{ color: 'var(--text-primary)' }}>{cnt}</strong></span>
                })}
              </div>
            ) : !navLoaded ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>загрузка данных...</span>
            ) : favoriteRoute ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>нет ТС на маршруте № {favoriteRoute}</span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>нет ТС на линии</span>
            )}
          </div>
          <button onClick={() => setShowPanel(true)}
            style={{ background: 'var(--orange-bg)', border: '1.5px solid var(--orange)', borderRadius: 20, padding: '8px 16px', color: 'var(--orange)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Подробнее
          </button>
        </div>
      </div>

      {/* ── Panel: список ТС (Навитранс) ── */}
      {showPanel && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPanel(false) }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 390, maxHeight: 'calc(var(--app-vh, 100vh) * 0.65)', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

            <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 17 }}>Сведения о ТС</span>
                {favoriteRoute && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)' }}>маршрут № {favoriteRoute}</span>}
              </div>
              <button onClick={() => setShowPanel(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1, padding: '0 4px' }}>✕</button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {navVehicles.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  {favoriteRoute ? `Нет данных с Навитранс для маршрута № ${favoriteRoute}` : 'Нет ТС на линии'}
                </div>
              ) : (
                navVehicles.map((v, i) => {
                  const plate      = v.plate_number || `ТС ${i + 1}`
                  const driver     = findLocalDriver(v.plate_number)
                  const driverName = driver ? abbreviateName(driver.full_name) : null
                  const isGps      = v.source === 'gps'
                  const dot        = isGps ? '#999999' : getDotColor(v.direction)
                  return (
                    <div key={`${v.unit_id ?? ''}-${i}`}
                      onClick={() => { setSelectedNav(v); setShowPanel(false) }}
                      style={{ padding: '13px 20px', borderBottom: i < navVehicles.length - 1 ? '1px solid #F5F5F5' : 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {favoriteRoute ? v.direction : `№${v.route_number ?? '—'} · ${v.direction}`}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 800, color: 'var(--orange)', fontSize: 16, letterSpacing: 0.3 }}>{plate}</span>
                          {driverName
                            ? <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{driverName}</span>
                            : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                          }
                          {isGps && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#888', background: '#EFEFEF', borderRadius: 6, padding: '2px 6px', letterSpacing: 0.3 }}>GPS</span>
                          )}
                        </div>
                        {isGps
                          ? <div style={{ fontSize: 12, color: '#FF6600', marginTop: 2 }}>📡 нет данных Навитранс · {v.speed.toFixed(0)} км/ч</div>
                          : v.model && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{v.model} · {v.speed.toFixed(0)} км/ч</div>
                        }
                      </div>

                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Detail sheet: Навитранс ТС ── */}
      {selectedNav && (() => {
        const v          = selectedNav
        const plate      = v.plate_number || v.unit_id || '—'
        const driver     = findLocalDriver(v.plate_number)
        const driverName = driver ? abbreviateName(driver.full_name) : null
        const localVeh   = findLocalVehicle(v.plate_number)
        const isGps      = v.source === 'gps'
        const dot        = isGps ? '#999999' : getDotColor(v.direction)

        return (
          <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedNav(null) }}>
            <div style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 430, maxHeight: 'calc(var(--app-vh, 100vh) * 0.8)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>

              <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 17 }}>ТС на линии</span>
                <button onClick={() => setSelectedNav(null)}
                  style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1, padding: '0 4px' }}>✕</button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px 0' }}>

                {/* Direction + plate + model */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600, marginBottom: 6 }}>{v.direction}</div>
                    <div style={{ fontWeight: 900, fontSize: 24, color: 'var(--orange)', letterSpacing: 0.5, marginBottom: 2 }}>{plate}</div>
                    {v.model && <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{v.model}</div>}
                  </div>
                </div>

                {isGps && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 16, background: '#FFF3EE', borderRadius: 12 }}>
                    <span style={{ fontSize: 16 }}>📡</span>
                    <span style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600, lineHeight: 1.4 }}>
                      Нет данных с Навитранса по этому ТС — показано местоположение по GPS водителя
                    </span>
                  </div>
                )}

                {/* Info rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#F8F8F8', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>

                  {/* Nearest stop */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid #EEEEEE' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Текущее местоположение</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{nearestStopName ?? '…'}</div>
                    </div>
                  </div>

                  {/* Driver */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid #EEEEEE' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Водитель</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: driverName ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {driverName ?? '—'}
                      </div>
                    </div>
                  </div>

                  {/* Speed */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l4-4"/><circle cx="12" cy="12" r="1" fill="var(--orange)"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Скорость</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{v.speed.toFixed(0)} км/ч</div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, paddingBottom: 20 }}>
                  <button
                    onClick={() => { if (localVeh) { setSelectedNav(null); navigate(`/entrepreneur/vehicles/${localVeh.id}`) } }}
                    disabled={!localVeh}
                    style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: `2px solid ${localVeh ? 'var(--orange)' : '#E0E0E0'}`, background: 'white', color: localVeh ? 'var(--orange)' : '#BBBBBB', fontWeight: 700, fontSize: 14, cursor: localVeh ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <img src="/bus.png" width="16" height="16" style={{ opacity: localVeh ? 1 : 0.4 }} />
                    Карточка ТС
                  </button>
                  <button
                    onClick={() => { if (driver) { setSelectedNav(null); navigate(`/entrepreneur/drivers/${driver.id}`) } }}
                    disabled={!driver}
                    style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: 'none', background: driver ? 'var(--orange)' : '#E0E0E0', color: 'white', fontWeight: 700, fontSize: 14, cursor: driver ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Водитель
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Route picker dropdown ── */}
      {routeDropOpen && (
        <div style={{ position: 'fixed', top: routeDropPos.top, right: routeDropPos.right, width: routeDropPos.width, zIndex: 1001, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)', maxHeight: 280, overflowY: 'auto' }}>
          {favoriteRoute && (
            <div onMouseDown={clearRoute}
              style={{ padding: '11px 14px', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#FF3B30', fontWeight: 600, fontSize: 13 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFF5F5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Сбросить выбор
            </div>
          )}
          {routes.length === 0
            ? <div style={{ padding: '14px', fontSize: 13, color: 'var(--text-muted)' }}>Нет маршрутов</div>
            : routes.map(rt => {
              const isSelected = rt.number === favoriteRoute
              return (
                <div key={rt.number} onMouseDown={() => selectRoute(rt.number)}
                  style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isSelected ? '#FFF3EE' : 'white', borderBottom: '1px solid #F5F5F5' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#FAFAFA' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? '#FFF3EE' : 'white' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: isSelected ? 'var(--orange)' : '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: isSelected ? 'white' : 'var(--text-muted)' }}>{rt.number}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--orange)' : 'var(--text-primary)' }}>№ {rt.number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rt.start_point} → {rt.end_point}
                    </div>
                  </div>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
              )
            })
          }
        </div>
      )}
    </div>
  )
}
