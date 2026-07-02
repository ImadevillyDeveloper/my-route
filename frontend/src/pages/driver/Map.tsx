import { useEffect, useRef, useState, useCallback } from 'react'
import { getRivalsLive, computeCompetitorMapping, requestRecommendation, getMe, getRoutes, updateMe, getHint, getNearestStop } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'

declare global { interface Window { ymaps: any } }

const OMSK_LAT = 54.9885
const OMSK_LNG = 73.3242

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const ALL_ROUTES: string[] = [
  '1','3','5','6Н','8Н','11','12','13','14','16','17','20','21','22','23','24','25','26',
  '28','29','30','31','32','33','34','36к','37','39','45','46','47Н','49','50','51','52',
  '55','58','59','60','61','62','63','66','70','71','72','73','77','78','79','80','83',
  '87','88','89','90','94','95','96','98','100','103','106','109','110','112','116','117',
  '119','122','125','131','132','136','138','139','140','141','144','145','155','156','157',
  '158','159','160','161','162','165','168','169','171','172','173','174','177','178','185',
  '190','191','193','196','197','198','212','214','219','324','327','336','352','355','507П',
  'Тр.2','Тр.3','Тр.4','Тр.7','Тр.12','Тр.15','Тр.16','Тр.67',
  'Тм.1','Тм.2','Тм.4','Тм.7','Тм.8','Тм.9',
]

// Yandex Maps color presets for different routes (deterministic by route string hash)
// "CircleIcon" (not "CircleDotIcon") renders iconContent text inside the marker,
// so the route number stays visible on the map without hover/click.
const ROUTE_PRESETS = [
  'islands#blueCircleIcon',
  'islands#redCircleIcon',
  'islands#violetCircleIcon',
  'islands#darkblueCircleIcon',
  'islands#greenCircleIcon',
  'islands#pinkCircleIcon',
  'islands#darkgreenCircleIcon',
  'islands#yellowCircleIcon',
]
function routePreset(route: string): string {
  const hash = route.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ROUTE_PRESETS[hash % ROUTE_PRESETS.length]
}

interface Pos { lat: number; lng: number; speed: number }
interface RivalInfo {
  route: string; model: string; plate: string
  speed: number; direction: string; minutes: number; stop: string | null
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
  const [hint, setHint]             = useState<{ type: string; message: string | null; ahead?: any; behind?: any } | null>(null)
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

  const [driverRoute, setDriverRoute]   = useState('—')
  const [driverInfo, setDriverInfo]     = useState<any>(null)
  const [routeTerminals, setRouteTerminals] = useState<{ start: string; end: string } | null>(null)
  const routeTerminalsRef = useRef<{ start: string; end: string } | null>(null)
  const [direction, setDirection]       = useState<'forward' | 'back'>('forward')
  const directionRef = useRef<'forward' | 'back'>('forward')
  const [shiftStarted, setShiftStarted] = useState(false)
  const [navDriverPos, setNavDriverPos] = useState<{ lat: number; lng: number; speed: number } | null>(null)
  const navDriverPosRef = useRef<{ lat: number; lng: number; speed: number } | null>(null)
  const [isNavTracked, setIsNavTracked] = useState(false)
  const [navDirection, setNavDirection] = useState<string | null>(null)
  const [navToast, setNavToast]         = useState<{ text: string; type: 'ok' | 'warn' } | null>(null)
  const driverInfoRef    = useRef<any>(null)
  const driverRouteRef   = useRef('—')
  const wasNavTracked    = useRef<boolean | null>(null)
  const toastTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [rivals2, setRivals2] = useState<string[]>([])
  const [userLoaded, setUserLoaded] = useState(false)
  const [rivalInput, setRivalInput]   = useState('')
  const [rivalDropOpen, setRivalDropOpen] = useState(false)
  const [rivalDropPos, setRivalDropPos]   = useState({ top: 0, left: 0, width: 0 })
  const rivalInputRef = useRef<HTMLInputElement>(null)
  const rivalDropRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMe().then(r => {
      const u = r.data
      const route = u.route_number
      if (route) {
        setDriverRoute(route)
        getRoutes().then(rr => {
          const found = rr.data.find((x: any) => x.number === route)
          if (found?.start_point && found?.end_point) {
            const t = { start: found.start_point, end: found.end_point }
            routeTerminalsRef.current = t
            setRouteTerminals(t)
          }
        }).catch(() => {})
      }
      setDriverInfo(u)
      if (u.active_shift_start) setShiftStarted(true)
      if (u.active_direction === 'forward' || u.active_direction === 'back') {
        directionRef.current = u.active_direction
        setDirection(u.active_direction)
      }
      try {
        const savedRivals: string[] = u.rival_routes_json ? JSON.parse(u.rival_routes_json) : []
        setRivals2(savedRivals)
      } catch {}
      setUserLoaded(true)
    }).catch(() => { setUserLoaded(true) })
  }, [])

  const startShift = () => {
    const now = new Date().toISOString()
    setShiftStarted(true)
    updateMe({ active_shift_start: now }).catch(() => {})
  }

  const switchDirection = (d: 'forward' | 'back') => {
    directionRef.current = d
    setDirection(d)
    updateMe({ active_direction: d }).catch(() => {})
    loadAndFetch()
  }

  const dirLabel = (d: 'forward' | 'back') => {
    if (!routeTerminals) return d === 'forward' ? 'Туда' : 'Обратно'
    return d === 'forward' ? routeTerminals.end : routeTerminals.start
  }

  const shortLabel = (s: string) => s.length > 16 ? s.slice(0, 15) + '…' : s

  useEffect(() => {
    if (!userLoaded) return
    updateMe({ rival_routes_json: JSON.stringify(rivals2) }).catch(() => {})
    window.dispatchEvent(new CustomEvent('rival-routes-changed'))
  }, [rivals2, userLoaded])

  useEffect(() => {
    if (!rivalDropOpen) return
    const close = (e: MouseEvent) => {
      if (!rivalDropRef.current?.contains(e.target as Node)) setRivalDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [rivalDropOpen])

  const addRival = (r: string) => {
    if (!rivals2.includes(r)) {
      setRivals2(p => [...p, r])
      if (driverRoute !== '—') {
        computeCompetitorMapping(driverRoute, r).catch(() => {})
      }
    }
    setRivalInput('')
    setRivalDropOpen(false)
    rivalInputRef.current?.focus()
  }
  const removeRival = (r: string) => setRivals2(p => p.filter(x => x !== r))
  const rivalSuggestions = rivalInput.trim()
    ? ALL_ROUTES.filter(r => r.toLowerCase().includes(rivalInput.toLowerCase()) && !rivals2.includes(r)).slice(0, 8)
    : []

  const voiceOnRef = useRef(true)
  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'; u.rate = 0.9
    window.speechSynthesis.speak(u)
  }, [])

  // Sync positionRef so click handlers always get the latest driver position
  useEffect(() => { positionRef.current = position }, [position])
  useEffect(() => { driverInfoRef.current = driverInfo }, [driverInfo])
  useEffect(() => { driverRouteRef.current = driverRoute }, [driverRoute])

  // При загрузке маршрута водителя — прогоняем маппинг для всех уже сохранённых конкурентных маршрутов
  useEffect(() => {
    if (driverRoute === '—' || rivals2.length === 0) return
    rivals2.forEach(r => computeCompetitorMapping(driverRoute, r).catch(() => {}))
  }, [driverRoute]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Привязка метки к Навитрансу ─────────────────────────────────
  const showToast = useCallback((text: string, type: 'ok' | 'warn') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setNavToast({ text, type })
    toastTimer.current = setTimeout(() => setNavToast(null), 5000)
  }, [])

  useEffect(() => {
    if (!shiftStarted) return
    const poll = async () => {
      const route = driverRouteRef.current
      const plate = driverInfoRef.current?.vehicle_plate
      if (!route || route === '—' || !plate) return
      try {
        const res = await getRivalsLive([route])
        const myVeh = res.data.find((v: any) => v.plate_number === plate)

        if (!myVeh) {
          if (wasNavTracked.current !== false) {
            showToast('Связь с ТС потеряна, переключаюсь на ваш GPS', 'warn')
          }
          wasNavTracked.current = false
          setIsNavTracked(false)
          setNavDriverPos(null)
          return
        }

        const navLat = parseFloat(String(myVeh.lat ?? 0))
        const navLng = parseFloat(String(myVeh.lng ?? 0))
        if (!navLat || !navLng) { setIsNavTracked(false); return }

        const gps = positionRef.current
        if (gps && haversineKm(gps.lat, gps.lng, navLat, navLng) > 0.5) {
          if (wasNavTracked.current !== false) {
            showToast('Геопозиция расходится с данными ТС, переключаюсь на ваш GPS', 'warn')
          }
          wasNavTracked.current = false
          setIsNavTracked(false)
          setNavDriverPos(null)
          return
        }

        if (wasNavTracked.current !== true) {
          showToast('Синхронизировано с данными Навитранса', 'ok')
        }
        wasNavTracked.current = true
        const np = { lat: navLat, lng: navLng, speed: Math.round(parseFloat(String(myVeh.speed ?? 0))) }
        navDriverPosRef.current = np
        setNavDriverPos(np)
        setNavDirection(myVeh.direction || null)
        setIsNavTracked(true)
        // Синхронизируем ручной переключатель с реальным направлением
        if (myVeh.direction && routeTerminals) {
          const dest = (myVeh.direction as string).split(' → ')[1]?.trim() ?? ''
          const d = dest.toLowerCase().includes(routeTerminals.end.toLowerCase().slice(0, 6)) ? 'forward' : 'back'
          if (directionRef.current !== d) {
            directionRef.current = d
            setDirection(d)
            updateMe({ active_direction: d }).catch(() => {})
            loadAndFetch()
          }
        }
      } catch {
        if (wasNavTracked.current !== false) {
          showToast('Связь с ТС потеряна, переключаюсь на ваш GPS', 'warn')
        }
        wasNavTracked.current = false
        setIsNavTracked(false)
      }
    }
    poll()
    const t = setInterval(poll, 12000)
    return () => clearInterval(t)
  }, [shiftStarted, showToast])

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

  // ── Загрузка и поллинг конкурентов + подсказок (10 с) ───────────
  const loadAndFetch = useCallback(async () => {
    try {
      setRivalRoutes(rivals2)
      const terminals = routeTerminalsRef.current
      const dir = directionRef.current
      const ourDest = terminals ? (dir === 'forward' ? terminals.end : terminals.start) : ''

      // Помимо конкурентов, всегда подтягиваем ТС своего маршрута
      const routesToFetch = driverRoute !== '—' ? [...new Set([...rivals2, driverRoute])] : rivals2
      if (routesToFetch.length === 0) { setRivals([]); setHint(null); return }

      const res = await getRivalsLive(routesToFetch, driverRoute !== '—' ? driverRoute : undefined, ourDest || undefined)
      setRivals(res.data)
      setLiveError(false)

      // Fetch AI hint — use Navitrans position if tracked, otherwise GPS
      const navPos = navDriverPosRef.current
      const gpsPos = positionRef.current
      const activePos = navPos ?? gpsPos
      if (driverRoute !== '—' && ourDest && activePos) {
        try {
          const hr = await getHint(driverRoute, activePos.lat, activePos.lng, activePos.speed, ourDest)
          setHint(prev => {
            const newHint = hr.data
            if (newHint.type !== prev?.type && newHint.message) speak(newHint.message)
            return newHint
          })
        } catch { /* hint is optional */ }
      }
    } catch {
      setLiveError(true)
    }
  }, [driverRoute, rivals2])

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
  }, [mapReady, shiftStarted])

  useEffect(() => {
    const handleResize = () => { if (ymapRef.current) ymapRef.current.container.fitToViewport() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Метка водителя ───────────────────────────────────────────────
  const effectivePos = (isNavTracked && navDriverPos) ? navDriverPos : position
  const hasCenteredRef = useRef(false)

  useEffect(() => {
    if (!ymapRef.current || !mapReady || !effectivePos) return
    if (myMarkerRef.current) ymapRef.current.geoObjects.remove(myMarkerRef.current)
    const me = new window.ymaps.Placemark(
      [effectivePos.lat, effectivePos.lng],
      { balloonContent: `Моя позиция · ${effectivePos.speed} км/ч` },
      { preset: 'islands#orangeAutoIcon' }
    )
    ymapRef.current.geoObjects.add(me)
    myMarkerRef.current = me
    // Центрируем карту только на первом определении позиции — дальше пользователь
    // сам управляет картой, она больше не следует за меткой принудительно.
    if (!hasCenteredRef.current) {
      ymapRef.current.setCenter([effectivePos.lat, effectivePos.lng])
      hasCenteredRef.current = true
    }
  }, [effectivePos, mapReady])

  const recenterMap = () => {
    const pos = positionRef.current
    const np = navDriverPosRef.current
    const target = (isNavTracked && np) ? np : pos
    if (!ymapRef.current || !target) return
    ymapRef.current.setCenter([target.lat, target.lng])
  }

  // ── Плавное обновление маркеров конкурентов ─────────────────────
  useEffect(() => {
    if (!ymapRef.current || !mapReady) return

    const ymap = ymapRef.current
    const markersMap = rivalMarkersRef.current

    // Build a set of current unit IDs from new data (excluding our own vehicle)
    const myPlate = driverInfoRef.current?.vehicle_plate
    const incoming = new Map<string, any>()
    rivals.forEach((r: any, i: number) => {
      if (myPlate && r.plate_number === myPlate) return
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
      const isOwnRoute = routeNum === driverRouteRef.current

      const preset = isOwnRoute ? 'islands#orangeCircleIcon' : routePreset(routeNum)

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
          { iconContent: routeNum, hintContent: `№${routeNum}` },
          { preset, hasBalloon: false }
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
            stop:      null,
          })
          getNearestStop(capturedRoute, capturedLat, capturedLng).then(res => {
            setRivalInfo(prev =>
              prev && prev.route === capturedRoute && prev.plate === capturedPlate
                ? { ...prev, stop: res.data.name ?? null }
                : prev
            )
          }).catch(() => {})
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

  if (!shiftStarted) {
    const today = new Date()
    const dateStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`
    const plate = driverInfo?.vehicle_plate || '—'
    const route = driverInfo?.route_number  || '—'
    const name  = driverInfo?.full_name     || ''

    return (
      <div className="page" style={{ background: '#F7F7F7', paddingTop: 0 }}>
        <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>Мой.Маршрут</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Начало смены</div>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Маршрут */}
          <div className="card" style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>
              {route !== '—' ? route : '?'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Маршрут №{route}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{dateStr}</div>
            </div>
          </div>

          {/* Данные */}
          <div className="card">
            <div className="row-item">
              <div className="row-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span className="row-label">Водитель</span>
              <span className="row-value">{name || '—'}</span>
            </div>
            <div className="row-item">
              <div className="row-icon"><img src="/bus.png" width="20" height="20" /></div>
              <span className="row-label">Гос. номер ТС</span>
              <span className="row-value" style={{ color: plate !== '—' ? 'var(--orange)' : undefined }}>{plate}</span>
            </div>
            <div className="row-item">
              <div className="row-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <span className="row-label">Дата</span>
              <span className="row-value">{dateStr}</span>
            </div>
          </div>

          {/* Конкурентные маршруты */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Конкурентные маршруты</div>

            <div ref={rivalDropRef} style={{ position: 'relative', marginBottom: rivals2.length ? 10 : 0 }}>
              <input ref={rivalInputRef} className="form-input"
                placeholder="Введите номер маршрута..."
                value={rivalInput}
                onChange={e => {
                  setRivalInput(e.target.value)
                  if (rivalInputRef.current) {
                    const r = rivalInputRef.current.getBoundingClientRect()
                    setRivalDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
                  }
                  setRivalDropOpen(true)
                }}
                onFocus={() => {
                  if (rivalInput.trim() && rivalInputRef.current) {
                    const r = rivalInputRef.current.getBoundingClientRect()
                    setRivalDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
                    setRivalDropOpen(true)
                  }
                }}
                style={{ fontSize: 14, paddingRight: 36 }}
              />
              <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>

            {rivals2.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {rivals2.map(r => (
                  <div key={r} style={{ background: '#FFF3EE', borderRadius: 20, padding: '5px 10px 5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>№{r}</span>
                    <button onClick={() => removeRival(r)}
                      style={{ background: 'none', border: 'none', color: '#AAAAAA', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={startShift}
            style={{ marginTop: 8, padding: '18px 24px', borderRadius: 18, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 800, fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 4px 20px rgba(255,102,0,0.35)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Выйти на маршрут
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Время выхода на маршрут будет зафиксировано в отчёте
          </p>
        </div>

        {rivalDropOpen && rivalSuggestions.length > 0 && (
          <div style={{ position: 'fixed', top: rivalDropPos.top, left: rivalDropPos.left, width: rivalDropPos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)', zIndex: 2000, overflow: 'hidden' }}>
            {rivalSuggestions.map((r, i) => (
              <div key={r} onMouseDown={() => addRival(r)}
                style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: i < rivalSuggestions.length - 1 ? '1px solid #F5F5F5' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FFF3EE')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--orange)' }}>{r}</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Маршрут №{r}</span>
                <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
            ))}
          </div>
        )}
        {rivalDropOpen && rivalInput.trim() && rivalSuggestions.length === 0 && (
          <div style={{ position: 'fixed', top: rivalDropPos.top, left: rivalDropPos.left, width: rivalDropPos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid var(--border)', zIndex: 2000, padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>
            {rivals2.includes(rivalInput.trim()) ? 'Уже добавлен' : 'Маршрут не найден'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="map-page-root" style={{ display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>

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
        <button onClick={() => setVoiceOn(v => { voiceOnRef.current = !v; return !v })}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 16 }}>
          {voiceOn ? '🔊' : '🔇'}
        </button>
      </div>

      {/* Постоянная строка статуса навигации */}
      <div style={{ background: isNavTracked ? '#1A3D2A' : '#2C2C2E', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: isNavTracked ? '#34C759' : '#AAAAAA', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: isNavTracked ? '#34C759' : '#AAAAAA', flex: 1 }}>
          {isNavTracked
            ? `Навигация: данные Навитранса (ГЛОНАСС)`
            : `Навигация: GPS устройства`}
        </span>
        {isNavTracked && driverInfo?.vehicle_plate && (
          <span style={{ fontSize: 10, color: 'rgba(52,199,89,0.7)', fontWeight: 600 }}>
            {driverInfo.vehicle_plate}
          </span>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8E8E8', flexDirection: 'column', gap: 12 }}>
            <LogoLoader size={72} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загрузка карты...</span>
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {effectivePos && mapReady && (
          <button onClick={recenterMap}
            style={{ position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, borderRadius: '50%', background: 'white', border: 'none', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="5"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="5" y2="12"/>
              <line x1="19" y1="12" x2="22" y2="12"/>
            </svg>
          </button>
        )}

        {effectivePos && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'white', borderRadius: 12, padding: '8px 12px', boxShadow: 'var(--shadow-md)', textAlign: 'center', minWidth: 52 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--orange)', lineHeight: 1 }}>{effectivePos.speed}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>КМ/Ч</div>
            <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2, color: isNavTracked ? '#34C759' : '#AAAAAA', letterSpacing: 0.3 }}>
              {isNavTracked ? 'ГЛОНАСС' : 'GPS'}
            </div>
          </div>
        )}

        {rivalRoutes.length > 0 && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: liveError ? '#FFF0EF' : '#EDFAF1', borderRadius: 10, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: liveError ? '#FF3B30' : '#34C759' }}>
            {liveError ? '⚠ Нет связи' : `● LIVE · ${rivals.length} ТС`}
          </div>
        )}

        {rivalRoutes.length === 0 && mapReady && !navToast && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: 20, padding: '8px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Выберите конкурентов в Настройках
          </div>
        )}

        {navToast && (
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ background: navToast.type === 'ok' ? '#1C1C1E' : '#1C1C1E', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: navToast.type === 'ok' ? '#34C759' : '#FF9500', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.4 }}>{navToast.text}</span>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>
                {isNavTracked ? 'ГЛОНАСС' : 'GPS'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="map-info-bar" style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '12px 14px', paddingBottom: 'calc(12px + var(--nav-safe))' }}>
        {/* Направление движения */}
        {isNavTracked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, background: '#F0FBF4', borderRadius: 20, padding: '7px 12px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1E7A38', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {navDirection ?? 'Направление определяется...'}
            </span>
            <span style={{ fontSize: 10, color: '#34C759', fontWeight: 600, flexShrink: 0 }}>авто</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['forward', 'back'] as const).map(d => {
              const active = direction === d
              return (
                <button key={d} onClick={() => switchDirection(d)}
                  style={{ flex: 1, padding: '8px 6px', borderRadius: 20, border: `1.5px solid ${active ? 'var(--orange)' : 'var(--border)'}`, background: active ? 'var(--orange)' : 'white', color: active ? 'white' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>
                  {shortLabel(dirLabel(d))}
                </button>
              )
            })}
          </div>
        )}

        {(() => {
          if (!hint) return (
            <div style={{ background: '#F5F5F5', border: '1.5px solid #E0E0E0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <span style={{ fontSize: 13, color: '#999' }}>Анализирую конкурентную обстановку…</span>
            </div>
          )
          const cfg = hint.type === 'slow_down'
            ? { bg: '#FFF3F3', border: '#FFCDD2', icon: '🛑', color: '#C62828' }
            : hint.type === 'speed_up'
            ? { bg: '#F1F8E9', border: '#C5E1A5', icon: '🚀', color: '#2E7D32' }
            : hint.type === 'maintain'
            ? { bg: '#FFF8E1', border: '#FFE082', icon: '💡', color: '#E65100' }
            : { bg: '#F5F5F5', border: '#E0E0E0', icon: '✅', color: '#555' }
          return (
            <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 20, lineHeight: 1.3 }}>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: cfg.color, lineHeight: 1.4 }}>{hint.message}</p>
                {(hint.ahead || hint.behind) && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888', lineHeight: 1.4 }}>
                    {hint.ahead && `▲ №${hint.ahead.route} — ${hint.ahead.distance_m} м впереди`}
                    {hint.ahead && hint.behind && ' · '}
                    {hint.behind && `▼ №${hint.behind.route} — ${hint.behind.distance_m} м сзади${hint.behind.gap_s != null ? `, разрыв ${hint.behind.gap_s} с` : ''}`}
                  </p>
                )}
              </div>
            </div>
          )
        })()}
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
              { label: 'Текущая остановка:', value: rivalInfo.stop ?? '…' },
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
