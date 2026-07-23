import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getVehicles, getRoutes, createDriver, uploadDriverPhoto } from '../../api/client'
import { formatVU, formatPhone, capitalizeName } from '../../utils/format'
import BusIcon from '../../components/common/BusIcon'

const CheckCircle = () => (
  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
)

function PhotoPicker({ preview, onPick }: { preview: string | null; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0, cursor: 'pointer' }} onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f) }} />
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E8E8E8', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {preview
          ? <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        }
      </div>
      <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3"/></svg>
      </div>
    </div>
  )
}

const OIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{children}</div>
)

function DropdownRow({ icon, label, value, options, onSelect, dataAttr }: {
  icon: React.ReactNode; label: string; value: string
  options: string[]; onSelect: (v: string) => void; dataAttr: string
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
          <span style={{ color: value ? 'var(--orange)' : 'var(--text-muted)', fontWeight: value ? 600 : 400, fontSize: 14, marginRight: 4 }}>
            {value || 'Выберите'}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
          </svg>
        </div>
      </div>

      {open && (
        <div {...{ [dataAttr]: '' }} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 1000, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', minWidth: 150, maxHeight: 220, overflowY: 'auto' }}>
          {options.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>Нет данных</div>
          ) : options.map(opt => (
            <div key={opt} onClick={() => { onSelect(opt); setOpen(false) }}
              style={{ padding: '12px 16px', fontSize: 14, fontWeight: value === opt ? 700 : 500, color: value === opt ? 'var(--orange)' : 'var(--text-primary)', background: value === opt ? '#FFF3EE' : 'white', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', whiteSpace: 'nowrap' }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function EntDriverAdd() {
  const navigate = useNavigate()
  const location = useLocation()
  const presetRoute: string = (location.state as any)?.presetRoute ?? ''
  const [form, setForm] = useState({ last: '', first: '', mid: '', vu: '', plate: '', route: presetRoute, phone: '', password: '' })
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [vehiclesFull, setVehiclesFull] = useState<any[]>([])
  const [routes, setRoutes] = useState<string[]>([])

  useEffect(() => {
    getVehicles().then(r => setVehiclesFull(r.data)).catch(() => {})
    getRoutes().then(r => setRoutes(r.data.map((rt: any) => rt.number))).catch(() => {})
  }, [])

  const platesToShow = vehiclesFull
    .filter(v => !form.route || v.route_number === form.route)
    .map(v => v.plate_number)

  const selectPlate = (plate: string) => {
    const vehicle = vehiclesFull.find(v => v.plate_number === plate)
    setForm(p => ({ ...p, plate, route: vehicle?.route_number ?? p.route }))
  }

  const selectRoute = (route: string) => {
    const plateStillValid = vehiclesFull.some(v => v.plate_number === form.plate && v.route_number === route)
    setForm(p => ({ ...p, route, plate: plateStillValid ? p.plate : '' }))
  }

  const s = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  const sName = (k: 'last'|'first'|'mid') => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: capitalizeName(e.target.value) }))
  const sVU = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, vu: formatVU(e.target.value) }))
  const sPhone = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))

  const pickPhoto = (f: File) => {
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    if (!form.last.trim()) { setError('Введите фамилию водителя'); return }
    if (!form.vu.trim()) { setError('Введите номер водительского удостоверения'); return }
    if (form.password.trim().length < 4) { setError('Пароль для входа — минимум 4 символа'); return }
    setLoading(true)
    setError('')
    try {
      const fullName = [form.last, form.first, form.mid].filter(Boolean).join(' ')
      const res = await createDriver({
        full_name: fullName,
        driver_id: form.vu.trim(),
        password: form.password.trim(),
        phone: form.phone.trim() || undefined,
        plate_number: form.plate || undefined,
        route_number: form.route || undefined,
      })
      if (photoFile) {
        try { await uploadDriverPhoto(res.data.id, photoFile) } catch {}
      }
      setShowSuccess(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка при добавлении водителя')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Добавление Водителя</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Photo + ФИО */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <PhotoPicker preview={photoPreview} onPick={pickPhoto} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ФИО *</div>
              {(['Фамилия', 'Имя', 'Отчество'] as const).map((ph, i) => (
                <input key={ph} className="form-input" placeholder={ph}
                  value={[form.last, form.first, form.mid][i]}
                  onChange={sName((['last', 'first', 'mid'] as const)[i])}
                  style={{ padding: '8px 12px', fontSize: 14 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="card">
          <div className="row-item">
            <OIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </OIcon>
            <span className="row-label">Номер ВУ *</span>
            <input className="row-input" placeholder="00 00 123456" value={form.vu} onChange={sVU} />
          </div>
          {presetRoute ? (
            <div className="row-item">
              <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 17l2-7h14l2 7"/><path d="M5 17H2"/><path d="M19 17h3"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg></OIcon>
              <span className="row-label">Маршрут</span>
              <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14, marginRight: 4 }}>{form.route}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
          ) : (
            <DropdownRow
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 17l2-7h14l2 7"/><path d="M5 17H2"/><path d="M19 17h3"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>}
              label="Маршрут" value={form.route} options={routes}
              onSelect={selectRoute} dataAttr="data-add-route-drop"
            />
          )}
          <DropdownRow
            icon={<BusIcon size={20} />}
            label="Гос. номер ТС" value={form.plate} options={platesToShow}
            onSelect={selectPlate} dataAttr="data-add-plate-drop"
          />
          <div className="row-item">
            <OIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </OIcon>
            <span className="row-label">Телефон</span>
            <input className="row-input" placeholder="+7 (xxx) xxx-xx-xx" value={form.phone} onChange={sPhone} />
          </div>
          <div className="row-item">
            <OIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </OIcon>
            <span className="row-label">Пароль для входа *</span>
            <input className="row-input" placeholder="Придумайте пароль" value={form.password} onChange={s('password')} />
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEE', color: 'var(--danger)', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={loading} style={{ marginTop: 8, padding: '16px 24px', borderRadius: 16, border: 'none', background: loading ? '#ccc' : 'var(--orange)', color: 'white', fontWeight: 800, fontSize: 16, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
          <CheckCircle />
          <span style={{ flex: 1, textAlign: 'center', letterSpacing: 0.5 }}>{loading ? 'СОХРАНЕНИЕ...' : 'ДОБАВИТЬ ВОДИТЕЛЯ'}</span>
          <span style={{ fontSize: 22 }}>›</span>
        </button>
      </div>

      {showSuccess && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '32px 28px 28px', width: '100%', maxWidth: 340, position: 'relative', textAlign: 'center' }}>
            <button onClick={() => navigate('/entrepreneur/drivers')} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>

            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  <circle cx="19" cy="5" r="4" fill="var(--orange)" stroke="none"/>
                  <polyline points="17 5 18.5 6.5 21 3.5" stroke="white" strokeWidth="1.5" fill="none"/>
                </svg>
              </div>
            </div>

            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Водитель добавлен!</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
              Теперь он может войти в приложение<br />по своему номеру ВУ.
            </div>

            <button onClick={() => navigate('/entrepreneur/drivers')}
              style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
            >Готово</button>
          </div>
        </div>
      )}
    </div>
  )
}
