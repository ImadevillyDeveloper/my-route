import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getVehicle, getVehicleInsurance, getVehicleMaintenance, updateInsurance, updateMaintenance, getDrivers, getRoutes, updateDriver, deleteVehicle as apiDeleteVehicle, uploadVehiclePhoto, updateVehicle as apiUpdateVehicle } from '../../api/client'
import StatusBar from '../../components/common/StatusBar'
import LogoLoader from '../../components/common/LogoLoader'
import { useAuthStore } from '../../store/auth'
import { formatPlate } from '../../utils/format'

const toParkName = (name: string | null): string => {
  if (!name) return 'ИП'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 3) return `ИП ${parts[0]} ${parts[1][0]}.${parts[2][0]}.`
  if (parts.length === 2) return `ИП ${parts[0]} ${parts[1][0]}.`
  return `ИП ${name}`
}

const abbreviate = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2 || parts[1].includes('.')) return name
  const [last, first, pat] = parts
  return `${last} ${first[0].toUpperCase()}.${pat ? pat[0].toUpperCase() + '.' : ''}`.trim()
}

export const getDriverName = (dId: string): string => dId

// ── Subcomponents ─────────────────────────────────────────────────
const OIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{children}</div>
)

function EditableRow({ icon, label, value, onChange, color, locked }: {
  icon: React.ReactNode; label: string; value: string
  onChange?: (v: string) => void; color?: string; locked?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    if (locked || !onChange) return
    setDraft(value); setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  const save = () => { setEditing(false); if (draft !== value) onChange?.(draft) }

  return (
    <div className="row-item" style={{ cursor: locked ? 'default' : 'pointer' }} onClick={!editing ? startEdit : undefined}>
      <OIcon>{icon}</OIcon>
      <span className="row-label">{label}</span>
      {editing ? (
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
          style={{ flex: 1, textAlign: 'right', border: 'none', borderBottom: '1.5px solid var(--orange)', background: 'transparent', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: color ?? 'var(--orange)' }} />
      ) : (
        <span style={{ color: color ?? 'var(--orange)', fontWeight: 600, fontSize: 14 }}>{value}</span>
      )}
      {locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
    </div>
  )
}

function InlinePlate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  const start = () => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }
  const save = () => { const v = formatPlate(draft); setEditing(false); if (v && v !== value) onChange(v) }

  if (editing) return (
    <input ref={inputRef} value={draft} onChange={e => setDraft(formatPlate(e.target.value))}
      onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
      style={{ fontWeight: 800, fontSize: 16, border: 'none', borderBottom: '2px solid var(--orange)', background: 'transparent', outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)', width: '100%', padding: 0 }} />
  )
  return (
    <div onClick={start} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <span style={{ fontWeight: 800, fontSize: 16 }}>{value}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </div>
  )
}

// ── Date helpers ─────────────────────────────────────────────────
// "2026-08-22" → "до 22.08.26"
const isoToDisplay = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `до ${d}.${m}.${y.slice(2)}`
}

// "до 22.08.26" → "2026-08-22" (for API)
const displayToIso = (raw: string): string | null => {
  const m = raw.match(/(\d{1,2})\.(\d{2})\.(\d{2,4})/)
  if (!m) return null
  const [, d, mo, y] = m
  const year = y.length === 2 ? '20' + y : y
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// ── Defaults ──────────────────────────────────────────────────────
const VEHICLE_DEFAULTS = {
  driverIds: [] as string[],
  kasko: '',
  osago: '',
  to: '',
  plate: '',
}

// ── Main component ────────────────────────────────────────────────
export default function EntVehicleDetail() {
  const { id } = useParams()
  const [v, setV] = useState<any>(null)
  const navigate = useNavigate()
  const parkName = toParkName(useAuthStore(s => s.fullName))
  const storageKey = `vehicle_extra_${id}`

  const [data, setData] = useState<typeof VEHICLE_DEFAULTS>(() => {
    try {
      const saved = localStorage.getItem(`vehicle_extra_${id}`)
      return saved ? { ...VEHICLE_DEFAULTS, ...JSON.parse(saved) } : { ...VEHICLE_DEFAULTS }
    } catch { return { ...VEHICLE_DEFAULTS } }
  })

  const [dropOpen, setDropOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const [routeDropOpen, setRouteDropOpen] = useState(false)
  const [routeDropPos, setRouteDropPos] = useState({ top: 0, right: 0 })
  const [routes, setRoutes] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const routeRowRef = useRef<HTMLDivElement>(null)
  const [allDrivers, setAllDrivers] = useState<any[]>([])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    const preview = URL.createObjectURL(file)
    setPhoto(preview)
    try {
      const res = await uploadVehiclePhoto(Number(id), file)
      setV((prev: any) => prev ? { ...prev, avatar_url: res.data.avatar_url } : prev)
    } catch {}
    e.target.value = ''
  }

  useEffect(() => {
    if (!id) return
    getVehicle(Number(id)).then(r => {
      setV(r.data)
      if (r.data.avatar_url) setPhoto(`http://localhost:8000${r.data.avatar_url}`)
    }).catch(() => {})
    getDrivers().then(r => setAllDrivers(r.data)).catch(() => {})
    getRoutes().then(r => setRoutes(r.data.map((rt: any) => rt.number))).catch(() => {})

    // Загружаем страховку и ТО из БД, перекрываем localStorage-значения
    Promise.all([
      getVehicleInsurance(Number(id)).catch(() => ({ data: null })),
      getVehicleMaintenance(Number(id)).catch(() => ({ data: null })),
    ]).then(([insRes, maintRes]) => {
      const ins = insRes.data
      const maint = maintRes.data
      setData(prev => ({
        ...prev,
        kasko: ins?.kasko_end_date ? isoToDisplay(ins.kasko_end_date) : prev.kasko,
        osago: ins?.end_date       ? isoToDisplay(ins.end_date)       : prev.osago,
        to:    maint?.next_date    ? isoToDisplay(maint.next_date)    : prev.to,
      }))
    })
  }, [id])

  useEffect(() => {
    if (!dropOpen) return
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-drivers-drop]')) setDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropOpen])

  useEffect(() => {
    if (!routeDropOpen) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-route-drop]')) setRouteDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [routeDropOpen])

  const changeRoute = async (newRoute: string) => {
    setRouteDropOpen(false)
    if (!id || newRoute === v?.route_number) return
    // Обновляем ТС
    await apiUpdateVehicle(Number(id), { route_number: newRoute }).catch(() => {})
    setV((prev: any) => prev ? { ...prev, route_number: newRoute } : prev)
    // Синхронизируем маршрут у всех водителей этого ТС
    const assigned = allDrivers.filter((d: any) => d.plate_number === v?.plate_number)
    await Promise.all(assigned.map(d => updateDriver(d.id, { route_number: newRoute }).catch(() => {})))
    setAllDrivers(prev => prev.map((d: any) =>
      assigned.some(ad => ad.id === d.id) ? { ...d, route_number: newRoute } : d
    ))
  }

  const saveData = (next: typeof VEHICLE_DEFAULTS) => {
    setData(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  const set = (k: keyof Omit<typeof VEHICLE_DEFAULTS, 'driverIds'>) => (val: string) => {
    saveData({ ...data, [k]: val })
    if (!id) return
    // Синхронизируем в БД
    if (k === 'kasko') {
      const iso = displayToIso(val)
      if (iso) updateInsurance(Number(id), { kasko_end_date: iso }).catch(() => {})
    } else if (k === 'osago') {
      const iso = displayToIso(val)
      if (iso) updateInsurance(Number(id), { end_date: iso }).catch(() => {})
    } else if (k === 'to') {
      const iso = displayToIso(val)
      if (iso) updateMaintenance(Number(id), { next_date: iso }).catch(() => {})
    }
  }

  const deleteVehicle = async () => {
    if (!id) return
    try {
      await apiDeleteVehicle(Number(id))
    } catch {}
    navigate('/entrepreneur/vehicles')
  }

  const toggleDriver = (dId: string) => {
    if (!v) return
    const driverObj = allDrivers.find((d: any) => String(d.id) === dId)
    if (!driverObj) return
    const isAssigned = driverObj.plate_number === v.plate_number
    const newPlate = isAssigned ? '' : v.plate_number
    updateDriver(driverObj.id, { plate_number: newPlate })
      .then(res => {
        // обновляем локальный список водителей
        setAllDrivers((prev: any[]) => prev.map((d: any) =>
          d.id === driverObj.id ? res.data : d
        ))
      })
      .catch(() => {})
  }

  if (!v) return <LogoLoader fullPage />

  const route = v.route_number ?? ''
  // Все водители на маршруте этого ТС (по прямому полю route_number)
  const routeDrivers = route
    ? allDrivers.filter((d: any) => d.route_number === route)
    : allDrivers
  // Водители, назначенные на это ТС (у кого vehicle_plate совпадает)
  const assignedDrivers = allDrivers.filter((d: any) => d.plate_number === v.plate_number)
  const driverNames = assignedDrivers.length > 0
    ? assignedDrivers.map((d: any) => abbreviate(d.full_name)).join(', ')
    : 'не назначен'

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои ТС</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => photoInputRef.current?.click()}
            style={{ width: 68, height: 68, background: '#E8E8E8', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            {photo
              ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src="/bus.png" width="38" height="38" style={{ opacity: 0.35 }} />
            }
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <InlinePlate value={data.plate || v.plate_number} onChange={val => {
              saveData({ ...data, plate: val })
              apiUpdateVehicle(Number(id), { plate_number: val }).catch(() => {})
            }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{v.model} · №{route}</div>
          </div>
        </div>

        {/* Маршрут + Водители */}
        <div className="card">
          {/* Маршрут — dropdown */}
          <div data-route-drop>
            <div ref={routeRowRef} className="row-item" style={{ cursor: 'pointer' }}
              onClick={() => {
                if (!routeDropOpen && routeRowRef.current) {
                  const r = routeRowRef.current.getBoundingClientRect()
                  setRouteDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                }
                setRouteDropOpen(o => !o)
              }}>
              <OIcon>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 17l2-7h14l2 7"/><path d="M5 17H2"/><path d="M19 17h3"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>
              </OIcon>
              <span className="row-label">Маршрут</span>
              <span style={{ color: route ? 'var(--orange)' : 'var(--text-muted)', fontWeight: route ? 600 : 400, fontSize: 14, marginRight: 4 }}>
                {route ? `№ ${route}` : 'Не указан'}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <polyline points={routeDropOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
              </svg>
            </div>
          </div>

          <div data-drivers-drop>
            <div ref={rowRef} className="row-item" style={{ cursor: 'pointer', flexWrap: 'wrap', gap: 4 }}
              onClick={() => {
                if (!dropOpen && rowRef.current) {
                  const r = rowRef.current.getBoundingClientRect()
                  setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                }
                setDropOpen(o => !o)
              }}>
              <OIcon>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </OIcon>
              <span className="row-label">Водители</span>
              <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 13, flex: 1, textAlign: 'right', marginRight: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{driverNames}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <polyline points={dropOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
              </svg>
            </div>
          </div>

          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            label="Парк" value={parkName} locked
          />
        </div>

        {/* КАСКО / ОСАГО / Техосмотр */}
        <div className="card">
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            label="КАСКО" value={data.kasko} onChange={set('kasko')}
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>}
            label="ОСАГО" value={data.osago} onChange={set('osago')}
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
            label="Техосмотр" value={data.to} onChange={set('to')}
          />
        </div>

        {/* Напоминания */}
        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/entrepreneur/vehicles/${id}/reminders`)}>
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></OIcon>
            <span className="row-label">Настроить напоминания</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Нажмите на любое поле, чтобы изменить данные ТС
        </p>

        <button onClick={() => setConfirmDelete(true)}
          style={{ marginTop: 4, padding: '14px 24px', borderRadius: 16, border: '2px solid #FF3B30', background: 'white', color: '#FF3B30', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Удалить ТС
        </button>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFF0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Удалить ТС?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              {v.plate_number} ({v.model}) будет удалён из списка. Это действие нельзя отменить.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={deleteVehicle}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: '#FF3B30', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-select dropdown — position: fixed поверх всего */}
      {/* Route dropdown */}
      {routeDropOpen && (
        <div data-route-drop style={{ position: 'fixed', top: routeDropPos.top, right: routeDropPos.right, zIndex: 1001, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', minWidth: 160, maxHeight: 260, overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Выберите маршрут
          </div>
          {routes.length === 0
            ? <div style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>Нет маршрутов</div>
            : routes.map(r => (
              <div key={r} onClick={() => changeRoute(r)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', fontSize: 14, fontWeight: route === r ? 700 : 500, color: route === r ? 'var(--orange)' : 'var(--text-primary)', background: route === r ? '#FFF3EE' : 'white', cursor: 'pointer', borderBottom: '1px solid #F5F5F5' }}>
                <span>№ {r}</span>
                {route === r && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
            ))
          }
        </div>
      )}

      {dropOpen && (
        <div data-drivers-drop style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 1000, background: 'white', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', minWidth: 220 }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Маршрут №{route}
          </div>
          {routeDrivers.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>Нет водителей</div>
          ) : routeDrivers.map((d: any) => {
            const selected = d.plate_number === v.plate_number
            return (
              <div key={d.id} onClick={() => toggleDriver(String(d.id))}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', background: selected ? '#FFF3EE' : 'white', borderBottom: '1px solid #F5F5F5' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected ? 'var(--orange)' : 'var(--border)'}`, background: selected ? 'var(--orange)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: 14, fontWeight: selected ? 700 : 500, color: selected ? 'var(--orange)' : 'var(--text-primary)' }}>{abbreviate(d.full_name)}</span>
              </div>
            )
          })}
          <div style={{ padding: '8px 16px' }}>
            <button onClick={() => setDropOpen(false)}
              style={{ width: '100%', padding: '10px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
