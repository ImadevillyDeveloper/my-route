import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDrivers, updateDriver, deleteDriver, uploadDriverPhoto, getVehicles, getRoutes, resolveAssetUrl } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'
import BusIcon from '../../components/common/BusIcon'
import { formatPhone, formatVU } from '../../utils/format'
import { useAuthStore } from '../../store/auth'

const toParkName = (name: string | null): string => {
  if (!name) return 'ИП'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 3) return `ИП ${parts[0]} ${parts[1][0]}.${parts[2][0]}.`
  if (parts.length === 2) return `ИП ${parts[0]} ${parts[1][0]}.`
  return `ИП ${name}`
}

interface Driver {
  id: number
  full_name: string
  driver_id: string | null
  phone: string | null
  route_number: string | null
  plate_number: string | null
  avatar_url: string | null
}

export const driverIdNumber = (id: number): string => {
  const a = String(id % 900 + 100).padStart(3, '0')
  const b = String((id * 23) % 900 + 100).padStart(3, '0')
  const c = String((id * 47) % 900 + 100).padStart(3, '0')
  return `${a} - ${b} - ${c}`
}

// ── Subcomponents ──────────────────────────────────────────────────

const OIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{children}</div>
)

function InlineName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  const start = () => { setDraft(value); setEditing(true); setTimeout(() => ref.current?.focus(), 0) }
  const save = () => { setEditing(false); if (draft.trim() && draft !== value) onSave(draft.trim()) }

  if (editing) return (
    <input ref={ref} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
      style={{ fontWeight: 800, fontSize: 16, border: 'none', borderBottom: '2px solid var(--orange)', background: 'transparent', outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)', width: '100%', padding: 0 }}
    />
  )
  return (
    <div onClick={start} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <span style={{ fontWeight: 800, fontSize: 16 }}>{value}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </div>
  )
}

// Точная копия EditableRow из VehicleDetail (без useEffect — он ломает редактирование)
function EditableRow({ icon, label, value, onChange, locked }: {
  icon: React.ReactNode; label: string; value: string
  onChange?: (v: string) => void; locked?: boolean
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
          style={{ flex: 1, textAlign: 'right', border: 'none', borderBottom: '1.5px solid var(--orange)', background: 'transparent', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: 'var(--orange)' }} />
      ) : (
        <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14 }}>{value || '—'}</span>
      )}
      {locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
    </div>
  )
}

function DropdownRow({ icon, label, value, options, onSelect, onClear, dataAttr }: {
  icon: React.ReactNode; label: string; value: string
  options: string[]; onSelect: (v: string) => void; onClear?: () => void; dataAttr: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`[${dataAttr}]`)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, dataAttr])

  const handleOpen = () => {
    if (!open && rowRef.current) {
      const r = rowRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <div {...{ [dataAttr]: '' }}>
        <div ref={rowRef} className="row-item" style={{ cursor: 'pointer' }} onClick={handleOpen}>
          <OIcon>{icon}</OIcon>
          <span className="row-label">{label}</span>
          <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14, marginRight: 4 }}>
            {value || '—'}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
          </svg>
        </div>
      </div>
      {open && (
        <div {...{ [dataAttr]: '' }} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 1000, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', minWidth: 160, maxHeight: 240, overflowY: 'auto' }}>
          {onClear && (
            <div onClick={() => { onClear(); setOpen(false) }}
              style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: '#FF3B30', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Убрать маршрут
            </div>
          )}
          {options.length === 0
            ? <div style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>Нет данных</div>
            : options.map(opt => (
              <div key={opt} onClick={() => { onSelect(opt); setOpen(false) }}
                style={{ padding: '12px 16px', fontSize: 14, fontWeight: value === opt ? 700 : 500, color: value === opt ? 'var(--orange)' : 'var(--text-primary)', background: value === opt ? '#FFF3EE' : 'white', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', whiteSpace: 'nowrap' }}>
                {opt}
              </div>
            ))
          }
        </div>
      )}
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────────

export default function EntDriverDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const parkName = toParkName(useAuthStore(s => s.fullName))

  const [driver, setDriver]               = useState<Driver | null>(null)
  const [loading, setLoading]             = useState(true)
  const [vehicles, setVehicles]           = useState<any[]>([])
  const [routes, setRoutes]               = useState<string[]>([])
  const [localRoute, setLocalRoute]       = useState<string>('')   // локальный стейт маршрута для фильтра ТС
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getDrivers(), getVehicles(), getRoutes()])
      .then(([drRes, vRes, rRes]) => {
        const found: Driver | undefined = drRes.data.find((d: Driver) => String(d.id) === id)
        setDriver(found ?? null)
        setLocalRoute(found?.route_number ?? '')
        setVehicles(vRes.data)
        setRoutes(rRes.data.map((r: any) => r.number))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const save = (fields: object) => {
    if (!driver) return
    updateDriver(driver.id, fields)
      .then(res => {
        setDriver(res.data)
        setLocalRoute(res.data.route_number ?? '')
      })
      .catch(() => {})
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !driver) return
    setAvatarPreview(URL.createObjectURL(file))
    try {
      const res = await uploadDriverPhoto(driver.id, file)
      setDriver(d => d ? { ...d, avatar_url: res.data.avatar_url } : d)
    } catch {}
    e.target.value = ''
  }

  const selectRoute = (route: string) => {
    setLocalRoute(route)
    // если текущее ТС не на этом маршруте — снимаем его одним запросом
    const plateOnRoute = vehicles.some(
      v => v.plate_number === driver?.plate_number && v.route_number === route
    )
    const fields: Record<string, string> = { route_number: route }
    if (!plateOnRoute && driver?.plate_number) fields.plate_number = ''
    save(fields)
  }

  const selectPlate = (plate: string) => {
    // при выборе ТС — автоматически проставляем его маршрут
    const vehicle = vehicles.find(v => v.plate_number === plate)
    const routeFromVehicle = vehicle?.route_number ?? localRoute
    setLocalRoute(routeFromVehicle)          // сразу обновляем UI
    save({ plate_number: plate, route_number: routeFromVehicle })
  }

  const handleDelete = async () => {
    if (!driver) return
    setDeleting(true)
    try { await deleteDriver(driver.id); navigate('/entrepreneur/drivers') }
    catch { setDeleting(false); setConfirmDelete(false) }
  }

  if (loading) return <div className="page"><LogoLoader fullPage /></div>
  if (!driver) return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои Водители</span>
      </div>
      <div className="empty-state"><div className="empty-icon">👤</div><div>Водитель не найден</div></div>
    </div>
  )

  const avatarSrc = avatarPreview ?? (driver.avatar_url ? resolveAssetUrl(driver.avatar_url) : null)
  const platesToShow = vehicles
    .filter(v => !localRoute || v.route_number === localRoute)
    .map(v => v.plate_number as string)

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои Водители</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Шапка: фото + ФИО inline */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0, cursor: 'pointer' }}
            onClick={() => photoRef.current?.click()}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#E8E8E8', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarSrc
                ? <img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
            </div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 20, height: 20, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3"/></svg>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <InlineName value={driver.full_name} onSave={v => save({ full_name: v })} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              {driver.plate_number ?? '—'} · №{driver.route_number ?? '—'}
            </div>
          </div>
        </div>

        {/* Поля */}
        <div className="card">
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
            label="Номер ВУ" value={driver.driver_id ?? ''}
            onChange={v => save({ driver_id: formatVU(v) })}
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
            label="Телефон" value={driver.phone ?? ''}
            onChange={v => save({ phone: formatPhone(v) })}
          />
          <DropdownRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 17l2-7h14l2 7"/><path d="M5 17H2"/><path d="M19 17h3"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>}
            label="Маршрут"
            value={localRoute ? `№${localRoute}` : '—'}
            options={routes.map(r => `№${r}`)}
            onSelect={v => selectRoute(v.replace('№', ''))}
            onClear={localRoute ? () => { setLocalRoute(''); save({ route_number: '', plate_number: '' }) } : undefined}
            dataAttr="data-driver-route-drop"
          />
          <DropdownRow
            icon={<BusIcon size={20} />}
            label="Гос. номер ТС"
            value={driver.plate_number ?? '—'}
            options={platesToShow}
            onSelect={selectPlate}
            dataAttr="data-driver-plate-drop"
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            label="Парк" value={parkName} locked
          />
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
          Нажмите на любое поле, чтобы изменить данные водителя
        </p>

        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }}
            onClick={() => navigate('/entrepreneur/reports', { state: { filterDriver: driver.full_name } })}>
            <OIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
            </OIcon>
            <span className="row-label">Отчёты водителя</span>
            <span style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        <button onClick={() => setConfirmDelete(true)}
          style={{ marginTop: 4, padding: '14px 24px', borderRadius: 16, border: '2px solid #FF3B30', background: 'white', color: '#FF3B30', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Удалить водителя
        </button>
      </div>

      {confirmDelete && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFF0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Удалить водителя?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              {driver.full_name} будет удалён. Вход по его номеру ВУ станет невозможен.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: '#FF3B30', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                {deleting ? '...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
