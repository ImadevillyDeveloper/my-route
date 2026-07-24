import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adjustReport, deleteReport, getReport, updateReportStatus, getTrips, getAvailableVehiclesForReport, type Trip } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'
import BusIcon from '../../components/common/BusIcon'
import PickerRow from '../../components/common/PickerRow'
import TripsModal from '../../components/common/TripsModal'
import type { Report } from '../../types'

const OIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{children}</div>
)

function parseGet(notes: string) {
  return (key: string, def: string) => {
    const m = notes.match(new RegExp(`${key}:\\s*([^,]+)`))
    return m ? m[1].trim() : def
  }
}

function rebuildNotes(original: string, updates: Record<string, string>): string {
  let result = original || ''
  for (const [key, val] of Object.entries(updates)) {
    const re = new RegExp(`(${key}:\\s*)[^,]+`)
    if (re.test(result)) result = result.replace(re, `$1${val}`)
    else result = result ? `${result}, ${key}: ${val}` : `${key}: ${val}`
  }
  return result
}

// ЧЧ:ММ — двоеточие подставляется само после двух цифр, дальше ещё две цифры.
// Часы/минуты подрезаются посимвольно (первая цифра часа >2 сразу зажимается
// до "2", и т.п.), чтобы вообще нельзя было ввести, например, 25:00.
function clampTimeDigits(digits: string): string {
  digits = digits.slice(0, 4)
  if (digits.length >= 1 && digits[0] > '2') digits = '2' + digits.slice(1)
  if (digits.length >= 2 && digits[0] === '2' && digits[1] > '3') digits = digits[0] + '3' + digits.slice(2)
  if (digits.length >= 3 && digits[2] > '5') digits = digits.slice(0, 2) + '5' + digits.slice(3)
  return digits
}
function formatTimeDigits(digits: string): string {
  return digits.length < 2 ? digits : digits.slice(0, 2) + ':' + digits.slice(2)
}

function EditRow({ icon, label, value, editable, onChange, validate, errorMsg, inputMode, changed, mask }: {
  icon: React.ReactNode; label: string; value: string; editable?: boolean; onChange?: (v: string) => void
  validate?: (v: string) => boolean; errorMsg?: string; inputMode?: 'numeric' | 'decimal'; changed?: boolean; mask?: 'time'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const [err, setErr]         = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const start = () => { if (!editable || !onChange) return; setDraft(value); setErr(false); setEditing(true); setTimeout(() => ref.current?.focus(), 0) }
  const save  = () => {
    if (validate && !validate(draft)) { setErr(true); return }
    setEditing(false); setErr(false)
    if (draft !== value) onChange?.(draft)
  }

  return (
    <div>
      <div className="row-item" style={{ cursor: editable ? 'pointer' : 'default' }} onClick={!editing ? start : undefined}>
        <OIcon>{icon}</OIcon>
        <span className="row-label">{label}</span>
        {editing ? (
          <input ref={ref} value={draft} inputMode={mask === 'time' ? 'numeric' : inputMode} maxLength={mask === 'time' ? 5 : undefined}
            onChange={e => setDraft(mask === 'time' ? formatTimeDigits(clampTimeDigits(e.target.value.replace(/\D/g, ''))) : e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') { save(); return }
              // Backspace ровно на границе "ЧЧ:|" — без этого перехвата стирание
              // просто восстанавливает то же двоеточие обратно, и удалить цифру
              // до него становится невозможно.
              if (mask === 'time' && e.key === 'Backspace') {
                const el = e.currentTarget
                if (draft.length >= 3 && draft[2] === ':' && el.selectionStart === el.selectionEnd && el.selectionStart === 3) {
                  e.preventDefault()
                  setDraft(formatTimeDigits(draft.replace(/\D/g, '').slice(0, -1)))
                }
              }
            }}
            style={{ flex: 1, textAlign: 'right', border: 'none', borderBottom: `1.5px solid ${err ? '#FF3B30' : 'var(--orange)'}`, background: 'transparent', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: err ? '#FF3B30' : 'var(--orange)' }} />
        ) : (
          <span style={{ fontWeight: 600, fontSize: 15, color: changed ? 'var(--orange)' : 'var(--text-primary)' }}>{value}</span>
        )}
        {editable && !editing && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginLeft: 2 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
        {!editable && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0, marginLeft: 2 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
      </div>
      {err && <div style={{ fontSize: 11, color: '#FF3B30', padding: '0 16px 8px 52px' }}>{errorMsg ?? 'Неверное значение'}</div>}
    </div>
  )
}

/* ── Review modal (выплата и/или штраф — можно оба сразу) ──────────── */
function ReviewModal({ recommended, initialPay, initialFine, onConfirm, onClose }: {
  recommended: number; initialPay: boolean; initialFine: boolean
  onConfirm: (payment: number, fine: number, fineReason: string) => Promise<void>; onClose: () => void
}) {
  const [payOn,   setPayOn]   = useState(initialPay)
  const [useRec,  setUseRec]  = useState(true)   // true = рекомендованная, false = вручную
  const [manual,  setManual]  = useState('')
  const [fineOn,  setFineOn]  = useState(initialFine)
  const [fineAmount, setFineAmount] = useState('')
  const [fineReason, setFineReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  const manualVal   = parseInt(manual || '0')
  const payAmount   = payOn ? (useRec ? recommended : manualVal) : 0
  const fineAmountN = fineOn ? parseInt(fineAmount || '0') : 0
  const payValid    = !payOn || (useRec ? recommended > 0 : manualVal > 0)
  const fineValid   = !fineOn || fineAmountN > 0
  const canSubmit   = (payOn || fineOn) && payValid && fineValid

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    setLoading(true); setErr('')
    try { await onConfirm(payAmount, fineAmountN, fineReason.trim()) }
    catch { setErr('Ошибка при сохранении. Попробуйте ещё раз.'); setLoading(false) }
  }

  const ToggleHeader = ({ on, onToggle, color, bg, icon, title }: {
    on: boolean; onToggle: () => void; color: string; bg: string; icon: React.ReactNode; title: string
  }) => (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
      border: `2px solid ${on ? color : 'var(--border)'}`, background: on ? bg : 'white',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: on ? 'white' : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <span style={{ fontWeight: 700, fontSize: 14, flex: 1, textAlign: 'left' }}>{title}</span>
      <div className={`toggle ${on ? 'toggle-on' : 'toggle-off'}`}><div className="toggle-thumb" /></div>
    </div>
  )

  return (
    <div onClick={onClose} className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, padding: '24px 22px 22px', width: '100%', maxWidth: 360, maxHeight: 'calc(var(--app-vh, 100vh) * 0.85)', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>

        <div style={{ fontWeight: 900, fontSize: 19, marginBottom: 4 }}>Завершить проверку</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>Можно назначить выплату, штраф — или оба сразу</div>

        {/* Выплата */}
        <ToggleHeader on={payOn} onToggle={() => setPayOn(v => !v)} color="#34C759" bg="#EDFAF1" title="Начислить выплату"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />

        {payOn && (
          <div style={{ margin: '10px 0 4px', paddingLeft: 4 }}>
            <div onClick={() => setUseRec(true)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 12, marginBottom: 8, cursor: 'pointer',
              border: `1.5px solid ${useRec ? '#34C759' : 'var(--border)'}`,
              background: useRec ? '#F3FBF6' : 'white',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Рекомендованная</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>по карточкам</div>
              </div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#34C759' }}>{recommended.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div onClick={() => setUseRec(false)} style={{
              padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
              border: `1.5px solid ${!useRec ? '#34C759' : 'var(--border)'}`,
              background: !useRec ? '#F3FBF6' : 'white',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Вручную:</span>
              <input type="number" inputMode="numeric" value={manual}
                onChange={e => { setManual(e.target.value.replace(/\D/g, '')); setUseRec(false) }}
                onFocus={() => setUseRec(false)} placeholder="0"
                style={{ flex: 1, border: 'none', borderBottom: `1.5px solid ${!useRec ? '#34C759' : 'var(--border)'}`, background: 'transparent', fontSize: 15, fontWeight: 700, outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>₽</span>
            </div>
          </div>
        )}

        {/* Штраф */}
        <div style={{ marginTop: 12 }}>
          <ToggleHeader on={fineOn} onToggle={() => setFineOn(v => !v)} color="#FF3B30" bg="#FFF0EF" title="Назначить штраф"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>} />
        </div>

        {fineOn && (
          <div style={{ margin: '10px 0 4px', paddingLeft: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid #FFB3B3', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0, color: '#FF3B30' }}>Сумма:</span>
              <input type="number" inputMode="numeric" value={fineAmount} onChange={e => setFineAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, outline: 'none', fontFamily: 'inherit', color: '#FF3B30' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>₽</span>
            </div>
            <textarea value={fineReason} onChange={e => setFineReason(e.target.value)}
              placeholder="Причина (необязательно)"
              rows={2}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', color: 'var(--text-primary)' }} />
          </div>
        )}

        {err && <div style={{ color: '#FF3B30', fontSize: 13, marginTop: 14 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Отмена</button>
          <button type="button" onClick={handleSubmit}
            style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: canSubmit && !loading ? 'var(--orange)' : '#ccc', color: 'white', fontWeight: 700, fontSize: 15, cursor: canSubmit && !loading ? 'pointer' : 'default' }}>
            {loading ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────── */
export default function EntReportDetail() {
  const { id } = useParams()
  const [report, setReport]   = useState<Report | null>(null)
  const [updating, setUpdating] = useState(false)
  const [reviewModal, setReviewModal] = useState<{ pay: boolean; fine: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showTrips, setShowTrips] = useState(false)
  const [tripsList, setTripsList] = useState<Trip[] | null>(null)
  const [tripsLoading, setTripsLoading] = useState(false)
  const navigate = useNavigate()

  const handleDelete = async () => {
    try {
      await deleteReport(Number(id))
      navigate('/entrepreneur/reports')
    } catch {
      alert('Не удалось удалить отчёт. Проверьте соединение и попробуйте ещё раз.')
    }
  }

  const [trips,       setTrips]       = useState('')
  const [cards,       setCards]       = useState('')
  const [condition,   setCondition]   = useState('')
  const [shiftNumber, setShiftNumber] = useState('')
  const [plate,       setPlate]       = useState('')
  const [shiftStart,  setShiftStart]  = useState('')
  const [shiftEnd,    setShiftEnd]    = useState('')
  const [routeVehicles, setRouteVehicles] = useState<string[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [edited,    setEdited]    = useState(false)

  // Снимок значений на момент открытия отчёта — по нему решаем, что предприниматель
  // успел поправить (тогда текст поля красим оранжевым), а что осталось как прислал водитель (чёрным).
  const originalRef = useRef({ trips: '', cards: '', condition: '', shiftNumber: '', plate: '', shiftStart: '', shiftEnd: '' })

  useEffect(() => {
    if (!id) return
    getReport(Number(id)).then(r => {
      const rep = r.data as Report
      setReport(rep)
      const get = parseGet(rep.notes ?? '')
      const initial = {
        trips: get('Кругов', String(rep.total_trips)),
        cards: get('Карточек', '430'),
        condition: get('ТС', 'исправно'),
        shiftNumber: get('Смена', String(rep.id)),
        plate: rep.plate_number || get('Гос.номер', ''),
        shiftStart: rep.shift_start ?? '',
        shiftEnd: rep.shift_end ?? '',
      }
      setTrips(initial.trips)
      setCards(initial.cards)
      setCondition(initial.condition)
      setShiftNumber(initial.shiftNumber)
      setPlate(initial.plate)
      setShiftStart(initial.shiftStart)
      setShiftEnd(initial.shiftEnd)
      originalRef.current = initial
      setEdited(false)
    }).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!report?.id) return
    setTripsLoading(true)
    getTrips({ report_id: report.id }).then(r => setTripsList(r.data)).catch(() => setTripsList([])).finally(() => setTripsLoading(false))
  }, [report?.id])

  // Список ТС маршрута, свободных именно в это время этой даты — учитывает
  // остальные отчёты за тот же день с пересекающимся временем смены, а не
  // только сам факт занятости в этот день.
  useEffect(() => {
    if (!report?.route_number || !report?.shift_date) { setRouteVehicles([]); return }
    setVehiclesLoading(true)
    getAvailableVehiclesForReport({
      route_number: report.route_number,
      shift_date: report.shift_date,
      shift_start: shiftStart || undefined,
      shift_end: shiftEnd || undefined,
      exclude_report_id: report.id,
    }).then(r => {
      setRouteVehicles((r.data as any[]).map(v => v.plate_number as string))
    }).catch(() => setRouteVehicles([]))
      .finally(() => setVehiclesLoading(false))
  }, [report?.route_number, report?.shift_date, report?.id, shiftStart, shiftEnd])

  const markEdited = (setter: (v: string) => void) => (v: string) => { setter(v); setEdited(true) }

  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
  const NUM_RE  = /^\d+(\.\d+)?$/
  const INT_RE  = /^\d+$/
  const CONDITIONS = ['исправно', 'неисправно', 'требует ТО']

  const isShiftStartValid  = shiftStart.trim() === '' || TIME_RE.test(shiftStart.trim())
  const isShiftEndValid    = shiftEnd.trim() === '' || TIME_RE.test(shiftEnd.trim())
  const isShiftNumberValid = INT_RE.test(shiftNumber.trim())
  const isPlateValid       = plate.trim() !== ''
  const isTripsValid       = NUM_RE.test(trips.trim())
  const isCardsValid       = INT_RE.test(cards.trim())
  const isConditionValid   = CONDITIONS.includes(condition)
  const allValid = isShiftStartValid && isShiftEndValid && isShiftNumberValid && isPlateValid && isTripsValid && isCardsValid && isConditionValid

  const plateOptions = plate && !routeVehicles.includes(plate) ? [plate, ...routeVehicles] : routeVehicles

  const recommended = Math.max(0, Math.round((parseInt(cards || '0') * 10) / 100) * 100)

  const editedFields = () => ({
    notes: { 'Смена': shiftNumber, 'Гос.номер': plate, 'Кругов': trips, 'Карточек': cards, 'ТС': condition },
    fields: {
      shift_start: shiftStart, shift_end: shiftEnd, plate_number: plate,
      total_trips: Number(trips) || 0, total_revenue: Number(cards) * 50 || 0,
    },
  })

  // Выплата и штраф больше не взаимоисключающие действия: можно назначить любое
  // из них или оба сразу за один раз. Штраф сам по себе больше не переводит
  // отчёт в «отклонён» — это просто дополнительное начисление, отчёт всё равно
  // считается проверенным (approved/adjusted).
  const handleReview = async (payment: number, fine: number, fineReason: string): Promise<void> => {
    if (!report || !allValid) return
    setUpdating(true)
    try {
      const { notes, fields } = editedFields()
      const updates: Record<string, string> = { ...notes }
      if (payment > 0) updates['Выплата'] = String(payment)
      if (fine > 0) {
        updates['Штраф'] = String(fine)
        if (fineReason) updates['Причина'] = fineReason
      }
      const updatedNotes = rebuildNotes(report.notes ?? '', updates)
      await adjustReport(report.id, edited ? 'adjusted' : 'approved', updatedNotes, fields)
      navigate('/entrepreneur/reports')
    } finally { setUpdating(false) }
  }

  if (!report) return <LogoLoader fullPage />

  const dateStr = (() => {
    const d = new Date(report.shift_date)
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`
  })()

  const isPending  = report.status === 'pending'
  const isApproved = report.status === 'approved'
  const isAdjusted = report.status === 'adjusted'
  const isRejected = report.status === 'rejected'

  const statusIcon = isPending
    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFAA00" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    : isApproved
    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
    : isAdjusted
    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

  const statusBg = isPending ? '#FFF3CD' : isApproved ? '#EDFAF1' : isAdjusted ? '#EFF6FF' : '#FFF0EF'

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои Отчёты</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Date card */}
        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, background: statusBg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{statusIcon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Отчёт за</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--orange)', lineHeight: 1.2 }}>{dateStr}</div>
          </div>
          {isAdjusted && <span style={{ fontSize: 11, fontWeight: 700, color: '#007AFF', background: '#EFF6FF', borderRadius: 20, padding: '3px 10px' }}>скорректирован</span>}
        </div>

        {/* Driver */}
        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--orange)' }}>{report.driver_name ?? 'Водитель'}</span>
        </div>

        {/* Fields */}
        <div className="card">
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            label="Начало смены" value={shiftStart} editable={isPending} onChange={isPending ? markEdited(setShiftStart) : undefined}
            validate={v => v.trim() === '' || TIME_RE.test(v.trim())} errorMsg="Формат ЧЧ:ММ" changed={shiftStart !== originalRef.current.shiftStart} mask="time" />
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            label="Окончание смены" value={shiftEnd} editable={isPending} onChange={isPending ? markEdited(setShiftEnd) : undefined}
            validate={v => v.trim() === '' || TIME_RE.test(v.trim())} errorMsg="Формат ЧЧ:ММ" changed={shiftEnd !== originalRef.current.shiftEnd} mask="time" />
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Номер смены" value={shiftNumber} editable={isPending} onChange={isPending ? markEdited(setShiftNumber) : undefined}
            validate={v => INT_RE.test(v.trim())} errorMsg="Только цифры" inputMode="numeric" changed={shiftNumber !== originalRef.current.shiftNumber} />
          <PickerRow icon={<OIcon><BusIcon size={20} /></OIcon>} label="Гос.номер ТС" value={plate} options={plateOptions}
            editable={isPending} onChange={isPending ? (v => { setPlate(v); setEdited(true) }) : undefined}
            loading={vehiclesLoading} emptyText="Нет свободных ТС на это время" changed={plate !== originalRef.current.plate} />
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>}
            label="Кол-во кругов" value={trips} editable={isPending} onChange={isPending ? markEdited(setTrips) : undefined}
            validate={v => NUM_RE.test(v.trim())} errorMsg="Число, например 5.5" inputMode="decimal" changed={trips !== originalRef.current.trips} />
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => setShowTrips(true)}>
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></OIcon>
            <span className="row-label">Время рейсов</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
            label="Кол-во карточек" value={cards} editable={isPending} onChange={isPending ? markEdited(setCards) : undefined}
            validate={v => INT_RE.test(v.trim())} errorMsg="Только цифры" inputMode="numeric" changed={cards !== originalRef.current.cards} />
          <PickerRow icon={<OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="13 2 13 9 20 9"/><path d="M20 9L13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/></svg></OIcon>}
            label="Состояние ТС" value={condition} options={CONDITIONS}
            editable={isPending} onChange={isPending ? (v => { setCondition(v); setEdited(true) }) : undefined} changed={condition !== originalRef.current.condition} />

          <div className="row-item" style={{ cursor: 'pointer', background: '#F0F8FF', borderRadius: 10, margin: '4px 0' }}>
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><circle cx="12" cy="13" r="2"/><polyline points="10 15 12 17 14 15"/></svg></OIcon>
            <span className="row-label">Просмотреть чек</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        {isPending && edited && (
          <p style={{ fontSize: 12, color: '#007AFF', textAlign: 'center' }}>✏️ Вы изменили поля — отчёт будет отмечен как «скорректирован»</p>
        )}
        {isPending && !allValid && (
          <p style={{ fontSize: 12, color: '#FF3B30', textAlign: 'center' }}>⚠️ Проверьте поля с ошибками перед сохранением</p>
        )}

        {/* Начисление / штраф — показываем после проверки */}
        {!isPending && (() => {
          const get = parseGet(report.notes ?? '')
          const payment = get('Выплата', '')
          const fine    = get('Штраф', '')
          const reason  = get('Причина', '')
          if (!payment && !fine) return null
          return (
            <div className="card">
              {payment && (
                <div className="row-item" style={{ background: '#EDFAF1', borderRadius: 10, margin: '4px 0' }}>
                  <div className="row-icon" style={{ background: '#D4F3E0', borderRadius: 8 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <span className="row-label">Начисление водителю</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#34C759' }}>+{parseInt(payment).toLocaleString('ru-RU')} ₽</span>
                </div>
              )}
              {fine && (
                <>
                  <div className="row-item" style={{ background: '#FFF0EF', borderRadius: reason ? '10px 10px 0 0' : 10, margin: '4px 0', marginBottom: reason ? 0 : '4px' }}>
                    <div className="row-icon" style={{ background: '#FFD9D7', borderRadius: 8 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </div>
                    <span className="row-label">Штраф водителю</span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#FF3B30' }}>−{parseInt(fine).toLocaleString('ru-RU')} ₽</span>
                  </div>
                  {reason && (
                    <div style={{ background: '#FFF0EF', borderRadius: '0 0 10px 10px', padding: '6px 16px 10px', margin: '0 4px 4px' }}>
                      <span style={{ fontSize: 13, color: '#FF3B30', fontWeight: 500 }}>Причина: {reason}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {/* Action buttons */}
        {isPending && (
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => setReviewModal({ pay: true, fine: false })} disabled={updating || !allValid}
              style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: `2px solid ${allValid ? '#34C759' : '#ccc'}`, background: 'white', color: allValid ? '#34C759' : '#999', fontWeight: 700, fontSize: 14, cursor: (updating || !allValid) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: allValid ? 1 : 0.6 }}>
              <span style={{ fontSize: 18, fontWeight: 900 }}>+</span> Начислить<br/>выплату
            </button>
            <button onClick={() => setReviewModal({ pay: false, fine: true })} disabled={updating || !allValid}
              style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: `2px solid ${allValid ? '#FFB3B3' : '#ccc'}`, background: allValid ? '#FFF5F5' : '#F5F5F5', color: allValid ? '#FF3B30' : '#999', fontWeight: 700, fontSize: 14, cursor: (updating || !allValid) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: allValid ? 1 : 0.6 }}>
              <span style={{ fontSize: 18, fontWeight: 900 }}>−</span> Назначить штраф
            </button>
          </div>
        )}

        {(isRejected || isApproved || isAdjusted) && (
          <div style={{ textAlign: 'center', padding: '8px', fontSize: 14, color: 'var(--text-muted)' }}>
            Статус:&nbsp;
            <span style={{ fontWeight: 700, color: isApproved ? '#34C759' : isAdjusted ? '#007AFF' : '#FF3B30' }}>
              {isApproved ? 'принят' : isAdjusted ? 'скорректирован' : 'отклонён'}
            </span>
          </div>
        )}

        <button onClick={() => setConfirmDelete(true)}
          style={{ width: '100%', padding: '14px', borderRadius: 50, border: '2px solid #FFB3B3', background: '#FFF5F5', color: '#FF3B30', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>
          Удалить отчёт
        </button>
      </div>

      {confirmDelete && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 340, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFF0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Удалить отчёт?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              Отчёт за {report.shift_date} будет удалён без возможности восстановления.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={handleDelete}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: '#FF3B30', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewModal && (
        <ReviewModal recommended={recommended} initialPay={reviewModal.pay} initialFine={reviewModal.fine}
          onConfirm={handleReview} onClose={() => setReviewModal(null)} />
      )}
      {showTrips && (
        <TripsModal trips={tripsList} loading={tripsLoading} onClose={() => setShowTrips(false)} onTripsChange={setTripsList} />
      )}
    </div>
  )
}
