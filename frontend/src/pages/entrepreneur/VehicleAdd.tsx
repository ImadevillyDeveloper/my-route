import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getVehicles, getRoutes, createVehicle, updateInsurance, updateMaintenance, getDrivers, updateDriver, uploadVehiclePhoto } from '../../api/client'
import { formatPlate } from '../../utils/format'

const abbr = (n: string) => {
  const p = n.trim().split(/\s+/)
  if (p.length < 2) return n
  return `${p[0]} ${p[1][0].toUpperCase()}.${p[2] ? p[2][0].toUpperCase() + '.' : ''}`.trim()
}

// ── Subcomponents ─────────────────────────────────────────────────
const CameraCircle = () => (
  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', cursor: 'pointer' }}>
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3"/></svg>
    </div>
  </div>
)

const OIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{children}</div>
)

const CheckCircle = () => (
  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
)

// Combobox: dropdown с существующими вариантами + свободный ввод
function ModelCombobox({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter(o => o.toLowerCase().includes(value.toLowerCase()))

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-model-combo]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleFocus = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  return (
    <div ref={ref} data-model-combo style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        className="form-input"
        placeholder="Выберите или введите"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={handleFocus}
        style={{ fontSize: 13, width: '100%' }}
      />
      {open && filtered.length > 0 && (
        <div data-model-combo style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000, background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map(opt => (
            <div key={opt} onMouseDown={() => { onChange(opt); setOpen(false) }}
              style={{ padding: '11px 14px', fontSize: 13, fontWeight: value === opt ? 700 : 500, color: value === opt ? 'var(--orange)' : 'var(--text-primary)', background: value === opt ? '#FFF3EE' : 'white', cursor: 'pointer', borderBottom: '1px solid #F5F5F5' }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Single-select dropdown
function DropdownField({ label, value, options, onSelect, placeholder, locked, dataAttr }: {
  label: string; value: string; options: string[]; onSelect: (v: string) => void
  placeholder?: string; locked?: boolean; dataAttr: string
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
    if (locked) return
    if (!open && rowRef.current) {
      const r = rowRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <div {...{ [dataAttr]: '' }}>
        <div ref={rowRef} className="row-item" style={{ cursor: locked ? 'default' : 'pointer' }} onClick={handleOpen}>
          <span className="row-label">{label}</span>
          <span style={{ color: value ? 'var(--orange)' : 'var(--text-muted)', fontWeight: value ? 600 : 400, fontSize: 14, marginRight: 4 }}>
            {value || placeholder || 'Выберите'}
          </span>
          {locked
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
          }
        </div>
      </div>
      {open && (
        <div {...{ [dataAttr]: '' }} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 1000, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', minWidth: 160, maxHeight: 220, overflowY: 'auto' }}>
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

// Compact inline dropdown (for side-by-side layout)
function InlineDropdown({ value, options, onSelect, placeholder, locked, dataAttr }: {
  value: string; options: string[]; onSelect: (v: string) => void
  placeholder?: string; locked?: boolean; dataAttr: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`[${dataAttr}]`)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, dataAttr])

  const handleOpen = () => {
    if (locked) return
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 120) })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <div {...{ [dataAttr]: '' }} ref={ref} onClick={handleOpen}
        className="form-input"
        style={{ fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: locked ? 'default' : 'pointer', color: value ? 'var(--orange)' : 'var(--text-muted)', fontWeight: value ? 600 : 400 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || placeholder || 'Выберите'}</span>
        {locked
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
        }
      </div>
      {open && (
        <div {...{ [dataAttr]: '' }} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000, background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
          {options.length === 0
            ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>Нет данных</div>
            : options.map(opt => (
              <div key={opt} onMouseDown={() => { onSelect(opt); setOpen(false) }}
                style={{ padding: '10px 14px', fontSize: 13, fontWeight: value === opt ? 700 : 500, color: value === opt ? 'var(--orange)' : 'var(--text-primary)', background: value === opt ? '#FFF3EE' : 'white', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', whiteSpace: 'nowrap' }}>
                {opt}
              </div>
            ))
          }
        </div>
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function EntVehicleAdd() {
  const navigate = useNavigate()
  const location = useLocation()
  const presetRoute: string = (location.state as any)?.presetRoute ?? ''

  const [form, setForm] = useState({ model: '', plate: '', route: presetRoute, kasko: '', osago: '', to: '' })
  const [selectedDriverIds, setSelectedDriverIds] = useState<number[]>([])
  const [allDrivers, setAllDrivers] = useState<any[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const driversRowRef = useRef<HTMLDivElement>(null)

  const [existingModels, setExistingModels] = useState<string[]>([])
  const [routes, setRoutes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const photoFileRef = useRef<File | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    photoFileRef.current = file
    setPhoto(URL.createObjectURL(file))
    e.target.value = ''
  }

  useEffect(() => {
    getVehicles().then(r => {
      const models = [...new Set<string>(r.data.map((v: any) => v.model).filter(Boolean))]
      setExistingModels(models)
    }).catch(() => {})
    getRoutes().then(r => setRoutes(r.data.map((rt: any) => rt.number))).catch(() => {})
    getDrivers().then(r => setAllDrivers(r.data)).catch(() => {})
  }, [])

  // Drivers filtered by selected route
  const routeDrivers = form.route
    ? allDrivers.filter((d: any) => d.route_number === form.route)
    : allDrivers
  const driverNames = selectedDriverIds.length > 0
    ? selectedDriverIds.map(id => {
        const d = allDrivers.find((x: any) => x.id === id)
        return d ? abbr(d.full_name) : id
      }).join(', ')
    : 'не назначены'

  const toggleDriver = (dId: number) =>
    setSelectedDriverIds(prev => prev.includes(dId) ? prev.filter(x => x !== dId) : [...prev, dId])

  const selectRoute = (route: string) => {
    // Сбрасываем водителей не этого маршрута
    const validIds = selectedDriverIds.filter(id => {
      const d = allDrivers.find((x: any) => x.id === id)
      return d?.route_number === route
    })
    setSelectedDriverIds(validIds)
    setForm(p => ({ ...p, route }))
  }

  const openDriversDrop = () => {
    if (!dropOpen && driversRowRef.current) {
      const r = driversRowRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setDropOpen(o => !o)
  }

  useEffect(() => {
    if (!dropOpen) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-add-drivers-drop]')) setDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropOpen])

  const submit = async () => {
    if (!form.model || !form.plate) return
    setSaving(true)
    setSubmitError(null)
    try {
      const res = await createVehicle({ model: form.model, plate_number: form.plate, route_number: form.route || null })
      const newId = res.data.id
      setSavedId(newId)

      // Сохраняем страховку и ТО в БД
      const insurancePayload: Record<string, string> = {}
      if (form.osago) insurancePayload.end_date = form.osago
      if (form.kasko) insurancePayload.kasko_end_date = form.kasko
      if (Object.keys(insurancePayload).length > 0) {
        await updateInsurance(newId, insurancePayload).catch(() => {})
      }
      if (form.to) {
        await updateMaintenance(newId, { next_date: form.to }).catch(() => {})
      }

      // Фото → сервер
      if (photoFileRef.current) {
        await uploadVehiclePhoto(newId, photoFileRef.current).catch(() => {})
      }
      // Водители → БД через updateDriver
      await Promise.all(
        selectedDriverIds.map(dId =>
          updateDriver(dId, { plate_number: form.plate, route_number: form.route || undefined }).catch(() => {})
        )
      )
      setShowSuccess(true)
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setSubmitError('ТС с таким госномером уже существует')
      } else {
        setSubmitError('Не удалось добавить ТС. Попробуйте ещё раз.')
      }
    }
    finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Добавление ТС</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Фото + Модель + Гос.номер + Маршрут */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div onClick={() => photoInputRef.current?.click()}
              style={{ width: 72, height: 72, borderRadius: '50%', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', cursor: 'pointer', overflow: 'hidden' }}>
              {photo
                ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Модель ТС *</div>
                <ModelCombobox value={form.model} onChange={v => setForm(p => ({ ...p, model: v }))} options={existingModels} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Гос. номер *</div>
                  <input className="form-input" placeholder="А 123 АА 55" value={form.plate}
                    onChange={e => setForm(p => ({ ...p, plate: formatPlate(e.target.value) }))} style={{ fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Маршрут</div>
                  <InlineDropdown
                    value={form.route} options={routes} onSelect={selectRoute}
                    placeholder="№" locked={!!presetRoute} dataAttr="data-add-route-inline"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Водители + Парк */}
        <div className="card">
          <div data-add-drivers-drop>
            <div ref={driversRowRef} className="row-item" style={{ cursor: 'pointer' }} onClick={openDriversDrop}>
              <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></OIcon>
              <span className="row-label">Водители</span>
              <span style={{ color: selectedDriverIds.length > 0 ? 'var(--orange)' : 'var(--text-muted)', fontWeight: selectedDriverIds.length > 0 ? 600 : 400, fontSize: 13, flex: 1, textAlign: 'right', marginRight: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                {driverNames}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <polyline points={dropOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
              </svg>
            </div>
          </div>

          <div className="row-item">
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></OIcon>
            <span className="row-label">Парк</span>
            <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14 }}>ИП Черепанов В.Г.</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>

        {/* КАСКО / ОСАГО / Техосмотр */}
        <div className="card">
          {([
            { label: 'КАСКО',      key: 'kasko', icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
            { label: 'ОСАГО',      key: 'osago', icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> },
            { label: 'Техосмотр',  key: 'to',    icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
          ] as { label: string; key: 'kasko'|'osago'|'to'; icon: React.ReactNode }[]).map(({ label, key, icon }) => {
            const val: string = (form as any)[key]
            const display = val ? `до ${val.split('-').reverse().map((p, i) => i === 2 ? p.slice(2) : p).join('.')}` : 'Выберите'
            return (
              <div key={label} className="row-item">
                <OIcon>{icon}</OIcon>
                <span className="row-label">{label}</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: val ? 'var(--orange)' : 'var(--text-muted)', fontWeight: val ? 600 : 400 }}>{display}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <input type="date" value={val}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                </div>
              </div>
            )
          })}
        </div>

        {submitError && (
          <div style={{ background: '#FFF0F0', border: '1.5px solid #FFB3B3', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#CC3333', fontWeight: 600 }}>
            {submitError}
          </div>
        )}

        <button onClick={submit} disabled={saving || !form.model || !form.plate}
          style={{ marginTop: 8, padding: '16px 24px', borderRadius: 16, border: 'none', background: (!form.model || !form.plate) ? '#E5E5E5' : 'var(--orange)', color: 'white', fontWeight: 800, fontSize: 16, cursor: (!form.model || !form.plate) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 14, opacity: saving ? 0.7 : 1 }}>
          <CheckCircle />
          <span style={{ flex: 1, textAlign: 'center', letterSpacing: 0.5 }}>
            {saving ? 'СОХРАНЕНИЕ...' : 'ДОБАВИТЬ ТС'}
          </span>
          <span style={{ fontSize: 22 }}>›</span>
        </button>
      </div>

      {/* Drivers multi-select dropdown */}
      {dropOpen && (
        <div data-add-drivers-drop style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 1000, background: 'white', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', minWidth: 220 }}>
          {!form.route && (
            <div style={{ padding: '10px 16px 6px', fontSize: 12, color: '#FF9500', fontWeight: 600 }}>
              Сначала выберите маршрут
            </div>
          )}
          {form.route && (
            <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Маршрут №{form.route}
            </div>
          )}
          {routeDrivers.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>
              {form.route ? 'Нет водителей на маршруте' : 'Сначала выберите маршрут'}
            </div>
          ) : routeDrivers.map((d: any) => {
            const selected = selectedDriverIds.includes(d.id)
            return (
              <div key={d.id} onClick={() => toggleDriver(d.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', background: selected ? '#FFF3EE' : 'white', borderBottom: '1px solid #F5F5F5' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected ? 'var(--orange)' : 'var(--border)'}`, background: selected ? 'var(--orange)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: 14, fontWeight: selected ? 700 : 500, color: selected ? 'var(--orange)' : 'var(--text-primary)' }}>{abbr(d.full_name)}</span>
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

      {/* Success modal */}
      {showSuccess && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '32px 28px 28px', width: '100%', maxWidth: 340, textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <img src="/bus.png" width="44" height="44" />
                <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <span style={{ position: 'absolute', top: -4, right: -4, color: 'var(--orange)', fontSize: 14, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', top: 10, left: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: 0, right: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: -4, left: -4, color: 'var(--orange)', fontSize: 10, fontWeight: 700 }}>+</span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>ТС добавлено!</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
              {form.plate} · {form.model}<br />успешно добавлен в парк.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => navigate(-1)}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Назад
              </button>
              <button onClick={() => navigate(`/entrepreneur/vehicles/${savedId}`)}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Открыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
