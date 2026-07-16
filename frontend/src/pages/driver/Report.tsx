import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { scanReceipt, createReport, getMe, updateMe, getTrips } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'

interface Form {
  shift_number: string
  vehicle_plate: string
  circles_count: string
  cards_count: string
  vehicle_condition: string
}

const CONDITIONS = ['Выберите', 'исправно', 'неисправно', 'требует ТО']

const FieldRow = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="row-item">
    <div className="row-icon">{icon}</div>
    <span className="row-label">{label}</span>
    {children}
  </div>
)

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, padding: '32px 28px 28px', width: '100%', maxWidth: 320, position: 'relative', textAlign: 'center' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>
        {children}
      </div>
    </div>
  )
}

const Sparkles = () => (
  <>
    <span style={{ position: 'absolute', top: -4, right: -4, color: 'var(--orange)', fontSize: 14, fontWeight: 700 }}>+</span>
    <span style={{ position: 'absolute', top: 8, left: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
    <span style={{ position: 'absolute', bottom: 0, right: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
    <span style={{ position: 'absolute', bottom: -4, left: -2, color: 'var(--orange)', fontSize: 10, fontWeight: 700 }}>+</span>
  </>
)

const fmtTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function DriverReport() {
  const [scanned, setScanned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [shiftStartTime, setShiftStartTime] = useState('')
  const [shiftActive, setShiftActive] = useState<boolean | null>(null)  // null = ещё не проверили
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const navigate = useNavigate()

  const today = new Date()
  const dateStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getFullYear()).slice(2)}`

  const [driverRoute, setDriverRoute] = useState('')
  const [form, setForm] = useState<Form>({
    shift_number: '', vehicle_plate: '',
    circles_count: '', cards_count: '', vehicle_condition: 'Выберите',
  })

  useEffect(() => {
    getMe().then(r => {
      const plate = r.data.active_shift_vehicle_plate || r.data.vehicle_plate || ''
      const route = r.data.route_number  || ''
      setDriverRoute(route)
      setForm(p => ({ ...p, vehicle_plate: plate }))
      setShiftActive(!!r.data.active_shift_start)
      if (r.data.active_shift_start) {
        setShiftStartTime(fmtTime(r.data.active_shift_start))
        // Кол-во кругов предзаполняем по факту зафиксированных рейсов (кругов = рейсов / 2),
        // но поле остаётся редактируемым — водитель может поправить перед отправкой.
        getTrips({ shift_start_ref: r.data.active_shift_start }).then(tr => {
          if (tr.data.length > 0) set('circles_count', String(Math.round(tr.data.length / 2)))
        }).catch(() => {})
      }
    }).catch(() => setShiftActive(false))
  }, [])

  const set = (k: keyof Form, v: string) => setForm(p => ({ ...p, [k]: v }))
  const setDigits = (k: keyof Form, v: string) => set(k, v.replace(/\D/g, ''))

  const isDigits = (s: string) => /^\d+$/.test(s.trim())

  const isValid = () =>
    isDigits(form.shift_number) &&
    form.vehicle_plate.trim() !== '' &&
    isDigits(form.circles_count) &&
    isDigits(form.cards_count) &&
    form.vehicle_condition !== 'Выберите'

  const openCamera = async () => {
    setShowCamera(true)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = s
      if (videoRef.current) videoRef.current.srcObject = s
    } catch { setShowCamera(false) }
  }

  const capture = () => {
    if (!videoRef.current) return
    const c = document.createElement('canvas')
    c.width = videoRef.current.videoWidth
    c.height = videoRef.current.videoHeight
    c.getContext('2d')?.drawImage(videoRef.current, 0, 0)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setScanned(true)
    setShowCamera(false)
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setShowCamera(false)
  }

  const handleFile = async (file: File) => {
    try {
      const res = await scanReceipt(file)
      if (res.data.cards_count) set('cards_count', String(res.data.cards_count))
    } catch {}
    setScanned(true)
  }

  const handleSubmit = async () => {
    if (!isValid()) { setShowError(true); return }
    setSubmitting(true)
    try {
      const res = await createReport({
        route_number: driverRoute || form.vehicle_plate || undefined,
        plate_number: form.vehicle_plate || undefined,
        shift_date: new Date().toISOString().slice(0, 10),
        shift_start: shiftStartTime, shift_end: fmtTime(new Date().toISOString()),
        total_trips: Number(form.circles_count) || 0,
        total_revenue: Number(form.cards_count) * 50 || 0,
        fuel_cost: 0,
        notes: `Гос.номер: ${form.vehicle_plate}, Маршрут: ${driverRoute}, Смена: ${form.shift_number}, Выход: ${shiftStartTime || '—'}, Кругов: ${form.circles_count}, Карточек: ${form.cards_count}, ТС: ${form.vehicle_condition}`,
      })
      if (res.data?.id) setCreatedId(res.data.id)
      updateMe({ active_shift_start: '', active_shift_vehicle_plate: '' }).catch(() => {})
    } catch {}
    finally { setSubmitting(false) }
    setShowSuccess(true)
  }

  const resetForm = () => {
    setForm(p => ({ shift_number: '', vehicle_plate: p.vehicle_plate, circles_count: '', cards_count: '', vehicle_condition: 'Выберите' }))
    setScanned(false)
    setShowSuccess(false)
  }

  if (shiftActive === null) return <LogoLoader fullPage />

  if (!shiftActive) return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Формирование Отчёта</span>
      </div>
      <div style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Смена не начата</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Чтобы сформировать отчёт, сначала выйдите на маршрут на экране «Карта».
        </div>
        <button onClick={() => navigate('/driver/map')}
          style={{ marginTop: 8, padding: '14px 28px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          На карту
        </button>
      </div>
    </div>
  )

  if (showCamera) return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#111', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={stopCamera} style={{ background: 'none', border: 'none', color: 'white', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>ОТМЕНА</button>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 16, flex: 1, textAlign: 'center' }}>Сканирование чека</span>
        <span style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <p style={{ color: 'white', fontSize: 13, marginBottom: 16, textAlign: 'center', padding: '0 24px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            ⚡ Поместите чек в рамку<br />и он будет отсканирован автоматически
          </p>
          <div style={{ width: 260, height: 340, border: '2px solid var(--orange)', borderRadius: 12, position: 'relative' }}>
            <div style={{ position: 'absolute', top: '45%', left: 0, right: 0, height: 2, background: 'var(--orange)', opacity: 0.8 }} />
          </div>
        </div>
      </div>
      <div style={{ background: '#111', padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 30, padding: '10px 24px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          📁 Ввести данные вручную
        </button>
        <button onClick={capture} style={{ width: 70, height: 70, borderRadius: '50%', background: 'white', border: '4px solid rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 28 }}>📸</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { handleFile(f); setShowCamera(false) } }} />
    </div>
  )

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Формирование Отчёта</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Date card */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, background: 'var(--orange-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📋</div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Отчёт за</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--orange)' }}>{dateStr}</div>
          </div>
        </div>

        {/* Fields */}
        <div className="card">
          {shiftStartTime && (
            <FieldRow label="Начало смены:" icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}>
              <span className="row-value" style={{ color: 'var(--orange)' }}>{shiftStartTime}</span>
            </FieldRow>
          )}
          <FieldRow label="Номер смены:" icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}>
            <input className="row-input" placeholder="Введите..." value={form.shift_number} onChange={e => setDigits('shift_number', e.target.value)}
              inputMode="numeric" style={{ color: form.shift_number ? 'var(--orange)' : undefined }} />
          </FieldRow>
          <FieldRow label="Гос. номер ТС:" icon={<img src="/bus.png" width="20" height="20" />}>
            <span className={form.vehicle_plate ? 'row-value' : 'row-value-gray'}>
              {form.vehicle_plate || 'не назначен'}
            </span>
          </FieldRow>
          <FieldRow label="Кол-во кругов:" icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>}>
            <input className="row-input" placeholder="Введите..." value={form.circles_count} onChange={e => setDigits('circles_count', e.target.value)}
              inputMode="numeric" style={{ color: form.circles_count ? 'var(--orange)' : undefined }} />
          </FieldRow>
          <FieldRow label="Кол-во карточек:" icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}>
            <input className="row-input" placeholder="Введите..." value={form.cards_count} onChange={e => setDigits('cards_count', e.target.value)}
              inputMode="numeric" style={{ color: form.cards_count ? 'var(--orange)' : undefined }} />
          </FieldRow>
          <FieldRow label="Состояние ТС:" icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}>
            <select value={form.vehicle_condition} onChange={e => set('vehicle_condition', e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', color: form.vehicle_condition === 'Выберите' ? 'var(--text-muted)' : 'var(--orange)', textAlign: 'right' }}>
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
            <span className="row-arrow">›</span>
          </FieldRow>
        </div>

        {/* Scan button */}
        <button className={`scan-btn${scanned ? ' scan-btn-success' : ''}`} onClick={openCamera}>
          <span className="scan-btn-icon">{scanned ? '✅' : '📷'}</span>
          <span className="scan-btn-text">{scanned ? 'Чек успешно отсканирован' : 'Сканировать чек'}</span>
          <span className="scan-btn-arrow">›</span>
        </button>

        <button className="btn btn-primary btn-big" onClick={handleSubmit} disabled={submitting} style={{ marginTop: 4 }}>
          {submitting ? 'Отправка...' : 'ОТПРАВИТЬ ОТЧЁТ'}
        </button>
      </div>

      {/* Модалка: Отчёт отправлен */}
      {showSuccess && (
        <Modal onClose={resetForm}>
          <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 20px' }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </div>
            <Sparkles />
          </div>
          <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Отчёт отправлен!</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
            Ожидаем проверки предпринимателя.
          </div>
          <button onClick={() => { setShowSuccess(false); navigate(createdId ? `/driver/report/${createdId}` : '/driver/shifts') }}
            style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Просмотр отчёта
          </button>
        </Modal>
      )}

      {/* Модалка: Заполните все данные */}
      {showError && (
        <Modal onClose={() => setShowError(false)}>
          <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 20px' }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="13" y2="17"/>
                <path d="M6 22v-2a2 2 0 0 1 2-2h4"/>
              </svg>
            </div>
            <Sparkles />
          </div>
          <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Заполните все данные!</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
            Пожалуйста, заполните все поля<br />для продолжения.
          </div>
          <button onClick={() => setShowError(false)}
            style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            К заполнению
          </button>
        </Modal>
      )}
    </div>
  )
}
