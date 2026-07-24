import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, updateMe, computeCompetitorMapping, getKnownRoutes, getRoutes, getNamedStops, type NamedStop } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'

/** Одиночный поиск-выбор остановки-ориентира для одной конечной. */
function StopPickerRow({ terminalName, value, stops, onSelect }: {
  terminalName: string
  value: { stop_name: string; lat: number; lng: number; st_id?: string | null } | undefined
  stops: NamedStop[]
  onSelect: (stop: NamedStop) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    // Список позиционируется через position:fixed по координатам на момент открытия
    // и не пересчитывается сам — при скролле СТРАНИЦЫ просто закрываем его, как
    // ведут себя нативные выпадающие списки. Но сам список тоже скроллится
    // (overflowY:auto) — тот скролл идёт через тот же window-обработчик в фазе
    // захвата, поэтому его нужно явно отличать по e.target и не закрывать.
    const closeOnScroll = (e: Event) => {
      if (boxRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [open])

  const suggestions = query.trim()
    ? stops.filter(s => s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : stops.slice(0, 8)

  const openDrop = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  return (
    <div style={{ marginBottom: 12 }} ref={boxRef}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Конечная «{terminalName}»</div>
      <input ref={inputRef} className="form-input" style={{ fontSize: 14 }}
        placeholder="Выбрать остановку..."
        value={open ? query : (value?.stop_name ?? '')}
        onFocus={() => { setQuery(''); openDrop() }}
        onChange={e => { setQuery(e.target.value); openDrop() }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)', zIndex: 2000, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <div key={s.name} onMouseDown={() => { onSelect(s); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F5' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFF3EE')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DriverMapSettings() {
  const [voiceOn, setVoiceOn] = useState(true)
  const [hintsOn, setHintsOn] = useState(true)
  const [rivals, setRivals] = useState<string[]>([])
  const [userLoaded, setUserLoaded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [driverRoute, setDriverRoute] = useState('')
  const [allRoutes, setAllRoutes] = useState<string[]>([])
  const [routeTerminals, setRouteTerminals] = useState<{ start: string; end: string } | null>(null)
  const [namedStops, setNamedStops] = useState<NamedStop[]>([])
  const [terminalMap, setTerminalMap] = useState<Record<string, { stop_name: string; lat: number; lng: number; st_id?: string | null }>>({})
  const [scheduleRoutes, setScheduleRoutes] = useState<string[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      try {
        const r = await getMe()
        const route = r.data.route_number
        if (route) {
          setDriverRoute(route)
          try {
            const rr = await getRoutes()
            const found = rr.data.find((x: any) => x.number === route)
            if (found?.start_point && found?.end_point) setRouteTerminals({ start: found.start_point, end: found.end_point })
          } catch {}
          try {
            const res = await getNamedStops(route)
            setNamedStops(res.data)
          } catch {}
        }
        let savedRivals: string[] = []
        try {
          savedRivals = r.data.rival_routes_json ? JSON.parse(r.data.rival_routes_json) : []
          setRivals(savedRivals)
        } catch {}
        try {
          setTerminalMap(r.data.terminal_stops_json ? JSON.parse(r.data.terminal_stops_json) : {})
        } catch { setTerminalMap({}) }
        try {
          // Пока водитель не настроил список отдельно — в расписании показываем
          // все конкурентные маршруты (тот же дефолт, что и на бэкенде).
          setScheduleRoutes(r.data.schedule_routes_json != null ? JSON.parse(r.data.schedule_routes_json) : savedRivals)
        } catch { setScheduleRoutes(savedRivals) }
        setHintsOn(r.data.hints_enabled !== false)
        setVoiceOn(r.data.voice_enabled !== false)
      } finally {
        // Показываем страницу только когда реальные данные (включая маршрут,
        // конечные и остановки) уже подгружены — иначе на секунду мелькают
        // значения по умолчанию (включённые тумблеры, отсутствующая карточка).
        setUserLoaded(true)
      }
    })()

    getKnownRoutes().then(r => setAllRoutes(r.data)).catch(() => {})
  }, [])

  const selectTerminalStop = (terminalName: string, stop: NamedStop) => {
    setTerminalMap(prev => {
      const next = { ...prev, [terminalName]: { stop_name: stop.name, lat: stop.lat, lng: stop.lng, st_id: stop.st_id } }
      updateMe({ terminal_stops_json: JSON.stringify(next) }).catch(() => {})
      return next
    })
  }

  useEffect(() => {
    if (!userLoaded) return
    updateMe({ rival_routes_json: JSON.stringify(rivals) }).catch(() => {})
    window.dispatchEvent(new CustomEvent('rival-routes-changed'))
  }, [rivals, userLoaded])

  // Маршрут, убранный из конкурентных, автоматически убираем и из расписания на конечной
  useEffect(() => {
    setScheduleRoutes(prev => prev.filter(r => rivals.includes(r)))
  }, [rivals])

  useEffect(() => {
    if (!userLoaded) return
    updateMe({ schedule_routes_json: JSON.stringify(scheduleRoutes) }).catch(() => {})
  }, [scheduleRoutes, userLoaded])

  const toggle = (r: string) =>
    setRivals(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  const toggleScheduleRoute = (r: string) =>
    setScheduleRoutes(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  const addRoute = (r: string) => {
    if (!rivals.includes(r)) {
      setRivals(prev => [...prev, r])
      if (driverRoute) computeCompetitorMapping(driverRoute, r).catch(() => {})
    }
    setInputValue('')
    setDropOpen(false)
    inputRef.current?.focus()
  }

  // Close dropdown on outside click or scroll (fixed-position list doesn't track scroll)
  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setDropOpen(false)
    }
    const closeOnScroll = () => setDropOpen(false)
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [dropOpen])

  const suggestions = inputValue.trim()
    ? allRoutes.filter(r =>
        r.toLowerCase().includes(inputValue.toLowerCase()) && !rivals.includes(r)
      ).slice(0, 8)
    : []

  const toggleHints = () => {
    setHintsOn(prev => {
      const next = !prev
      updateMe({ hints_enabled: next }).catch(() => {})
      return next
    })
  }

  const toggleVoice = () => {
    setVoiceOn(prev => {
      const next = !prev
      updateMe({ voice_enabled: next }).catch(() => {})
      return next
    })
  }

  if (!userLoaded) return <LogoLoader fullPage />

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Карта и конкуренты</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Rival routes */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Конкурентные маршруты</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
            Выбранные маршруты отображаются на карте как конкуренты
          </div>

          {/* Autocomplete input */}
          <div ref={dropRef} style={{ position: 'relative', marginBottom: rivals.length ? 10 : 0 }}>
            <input
              ref={inputRef}
              className="form-input"
              placeholder="Введите номер маршрута..."
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value)
                if (inputRef.current) {
                  const r = inputRef.current.getBoundingClientRect()
                  setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
                }
                setDropOpen(true)
              }}
              onFocus={() => {
                if (inputValue.trim() && inputRef.current) {
                  const r = inputRef.current.getBoundingClientRect()
                  setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
                  setDropOpen(true)
                }
              }}
              style={{ fontSize: 14, paddingRight: 36 }}
            />
            <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>

          </div>

          {rivals.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rivals.map(r => (
                <div key={r} style={{ background: '#FFF3EE', borderRadius: 20, padding: '5px 10px 5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>№{r}</span>
                  <button onClick={() => toggle(r)}
                    style={{ background: 'none', border: 'none', color: '#AAAAAA', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Маршруты в расписании на конечных — подсписок конкурентных */}
        {rivals.length > 0 && (
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Маршруты в расписании на конечных</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
              Какие из конкурентных маршрутов показывать в расписании при закрытии рейса на конечной
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rivals.map(r => {
                const active = scheduleRoutes.includes(r)
                return (
                  <button key={r} onClick={() => toggleScheduleRoute(r)}
                    style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${active ? 'var(--orange)' : 'var(--border)'}`, background: active ? '#FFF3EE' : 'white', color: active ? 'var(--orange)' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    №{r}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Остановки-ориентиры на конечных */}
        {routeTerminals && (
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Остановки для расписания на конечных</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
              При закрытии рейса на конечной покажем расписание выбранной остановки, если сама конечная неинформативна
            </div>
            <StopPickerRow terminalName={routeTerminals.start} value={terminalMap[routeTerminals.start]} stops={namedStops}
              onSelect={s => selectTerminalStop(routeTerminals.start, s)} />
            <StopPickerRow terminalName={routeTerminals.end} value={terminalMap[routeTerminals.end]} stops={namedStops}
              onSelect={s => selectTerminalStop(routeTerminals.end, s)} />
          </div>
        )}

        {/* ИИ-подсказки и голосовой помощник временно скрыты от пользователей —
            логика/тумблеры оставлены в коде, просто не рендерятся (см. также
            driver/Map.tsx, где отключён сам показ подсказок/кнопки звука). */}
        {false && (
        <div className="card">
          <div className="row-item">
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </div>
            <span className="row-label">Голосовой помощник</span>
            <div className={`toggle ${voiceOn ? 'toggle-on' : 'toggle-off'}`} onClick={toggleVoice}>
              <div className="toggle-thumb" />
            </div>
          </div>
          <div className="row-item">
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
            <span className="row-label">Подсказки на карте</span>
            <div className={`toggle ${hintsOn ? 'toggle-on' : 'toggle-off'}`} onClick={toggleHints}>
              <div className="toggle-thumb" />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Autocomplete dropdown (fixed, чтобы не обрезался overflow:hidden карточки) */}
      {dropOpen && suggestions.length > 0 && (
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)', zIndex: 2000, overflow: 'hidden' }}>
          {suggestions.map((r, i) => (
            <div key={r} onMouseDown={() => addRoute(r)}
              style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F5' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFF3EE')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--orange)' }}>{r}</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Маршрут №{r}</span>
              <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
          ))}
        </div>
      )}
      {dropOpen && inputValue.trim() && suggestions.length === 0 && (
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid var(--border)', zIndex: 2000, padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>
          {rivals.includes(inputValue.trim()) ? 'Уже добавлен' : 'Маршрут не найден'}
        </div>
      )}
    </div>
  )
}
