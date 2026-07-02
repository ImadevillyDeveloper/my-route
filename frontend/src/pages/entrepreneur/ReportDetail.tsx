import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adjustReport, deleteReport, getReport, updateReportStatus } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'
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

function EditRow({ icon, label, value, editable, onChange }: {
  icon: React.ReactNode; label: string; value: string; editable?: boolean; onChange?: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  const start = () => { if (!editable || !onChange) return; setDraft(value); setEditing(true); setTimeout(() => ref.current?.focus(), 0) }
  const save  = () => { setEditing(false); if (draft !== value) onChange?.(draft) }

  return (
    <div className="row-item" style={{ cursor: editable ? 'pointer' : 'default' }} onClick={!editing ? start : undefined}>
      <OIcon>{icon}</OIcon>
      <span className="row-label">{label}</span>
      {editing ? (
        <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
          style={{ flex: 1, textAlign: 'right', border: 'none', borderBottom: '1.5px solid var(--orange)', background: 'transparent', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: 'var(--orange)' }} />
      ) : (
        <span style={{ fontWeight: 600, fontSize: 15 }}>{value}</span>
      )}
      {editable && !editing && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginLeft: 2 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
      {!editable && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0, marginLeft: 2 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
    </div>
  )
}

/* ── Payment modal ───────────────────────────────────────────────── */
function PayModal({ recommended, onConfirm, onClose }: {
  recommended: number; onConfirm: (amount: number) => Promise<void>; onClose: () => void
}) {
  const [useRec,  setUseRec]  = useState(true)   // true = recommended, false = manual
  const [manual,  setManual]  = useState('')
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  const manualVal = parseInt(manual || '0')
  const amount    = useRec ? recommended : manualVal
  const canSubmit = useRec ? recommended > 0 : manualVal > 0

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    setLoading(true); setErr('')
    try { await onConfirm(amount) }
    catch { setErr('Ошибка при сохранении. Попробуйте ещё раз.'); setLoading(false) }
  }

  return (
    <div onClick={onClose} className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, padding: '28px 24px 24px', width: '100%', maxWidth: 340, position: 'relative', textAlign: 'center' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>

        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 18px' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#EDFAF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span style={{ position: 'absolute', top: -4, right: -4, color: '#34C759', fontSize: 14, fontWeight: 700 }}>+</span>
          <span style={{ position: 'absolute', top: 10, left: -10, color: '#A8EFC0', fontSize: 11, fontWeight: 700 }}>+</span>
          <span style={{ position: 'absolute', bottom: -4, right: -8, color: '#A8EFC0', fontSize: 11, fontWeight: 700 }}>+</span>
        </div>

        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 18 }}>Начислить выплату</div>

        {/* Recommended */}
        <div onClick={() => setUseRec(true)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 14, marginBottom: 10, cursor: 'pointer',
          border: `2px solid ${useRec ? '#34C759' : 'var(--border)'}`,
          background: useRec ? '#EDFAF1' : 'white',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Рекомендованная сумма</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>рассчитана по карточкам</div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#34C759' }}>{recommended.toLocaleString('ru-RU')} ₽</div>
        </div>

        {/* Manual */}
        <div onClick={() => setUseRec(false)} style={{
          padding: '12px 16px', borderRadius: 14, marginBottom: 16, cursor: 'pointer',
          border: `2px solid ${!useRec ? '#34C759' : 'var(--border)'}`,
          background: !useRec ? '#EDFAF1' : 'white',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, textAlign: 'left', marginBottom: 8 }}>Ввести вручную</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" inputMode="numeric"
              value={manual}
              onChange={e => { setManual(e.target.value.replace(/\D/g, '')); setUseRec(false) }}
              onFocus={() => setUseRec(false)}
              placeholder="0"
              style={{ flex: 1, border: 'none', borderBottom: `1.5px solid ${!useRec ? '#34C759' : 'var(--border)'}`, background: 'transparent', fontSize: 18, fontWeight: 700, outline: 'none', fontFamily: 'inherit', padding: '4px 0', color: 'var(--text-primary)' }}
            />
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-muted)' }}>₽</span>
          </div>
        </div>

        {err && <div style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Отмена</button>
          <button type="button" onClick={handleSubmit}
            style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: canSubmit && !loading ? '#34C759' : '#ccc', color: 'white', fontWeight: 700, fontSize: 15, cursor: canSubmit && !loading ? 'pointer' : 'default' }}>
            {loading ? '...' : 'Начислить'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Fine modal ──────────────────────────────────────────────────── */
function FineModal({ onConfirm, onClose }: {
  onConfirm: (amount: number, comment: string) => Promise<void>; onClose: () => void
}) {
  const [amount,  setAmount]  = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')
  const canSubmit = amount.trim() !== '' && parseInt(amount) > 0

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    setLoading(true); setErr('')
    try { await onConfirm(parseInt(amount), comment) }
    catch { setErr('Ошибка при сохранении. Попробуйте ещё раз.'); setLoading(false) }
  }

  return (
    <div onClick={onClose} className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, padding: '28px 24px 24px', width: '100%', maxWidth: 340, position: 'relative', textAlign: 'center' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>

        {/* Icon */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 18px' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FFF0EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <span style={{ position: 'absolute', top: -4, right: -4, color: '#FF3B30', fontSize: 14, fontWeight: 700 }}>+</span>
          <span style={{ position: 'absolute', top: 10, left: -10, color: '#FFB3B3', fontSize: 11, fontWeight: 700 }}>+</span>
          <span style={{ position: 'absolute', bottom: -4, right: -8, color: '#FFB3B3', fontSize: 11, fontWeight: 700 }}>+</span>
        </div>

        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Назначить штраф</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Водитель увидит сумму и причину в своём отчёте</div>

        {/* Amount */}
        <div style={{ textAlign: 'left', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Сумма штрафа</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${canSubmit ? '#FF3B30' : 'var(--border)'}`, borderRadius: 12, padding: '10px 14px' }}>
            <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, outline: 'none', fontFamily: 'inherit', color: '#FF3B30' }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-muted)' }}>₽</span>
          </div>
        </div>

        {/* Comment */}
        <div style={{ textAlign: 'left', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Причина (необязательно)</div>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Например: нарушение расписания..."
            rows={2}
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', color: 'var(--text-primary)' }} />
        </div>

        {err && <div style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Отмена</button>
          <button type="button" onClick={handleSubmit}
            style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: canSubmit && !loading ? '#FF3B30' : '#ccc', color: 'white', fontWeight: 700, fontSize: 14, cursor: canSubmit && !loading ? 'pointer' : 'default' }}>
            {loading ? '...' : 'Назначить'}
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
  const [showPayModal, setShowPayModal] = useState(false)
  const [showFineModal, setShowFineModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const navigate = useNavigate()

  const handleDelete = async () => {
    try {
      await deleteReport(Number(id))
    } catch {}
    navigate('/entrepreneur/reports')
  }

  const [trips,     setTrips]     = useState('')
  const [cards,     setCards]     = useState('')
  const [condition, setCondition] = useState('')
  const [edited,    setEdited]    = useState(false)

  useEffect(() => {
    if (!id) return
    getReport(Number(id)).then(r => {
      const rep = r.data as Report
      setReport(rep)
      const get = parseGet(rep.notes ?? '')
      setTrips(get('Кругов', String(rep.total_trips)))
      setCards(get('Карточек', '430'))
      setCondition(get('ТС', 'исправно'))
      setEdited(false)
    }).catch(() => {})
  }, [id])

  const markEdited = (setter: (v: string) => void) => (v: string) => { setter(v); setEdited(true) }

  const recommended = Math.max(0, Math.round((parseInt(cards || '0') * 10) / 100) * 100)

  const handlePay = async (amount: number): Promise<void> => {
    if (!report) return
    setUpdating(true)
    try {
      const updatedNotes = rebuildNotes(report.notes ?? '', {
        'Кругов': trips, 'Карточек': cards, 'ТС': condition, 'Выплата': String(amount),
      })
      await adjustReport(report.id, edited ? 'adjusted' : 'approved', updatedNotes)
      navigate('/entrepreneur/reports')
    } finally { setUpdating(false) }
  }

  const handleFine = async (amount: number, comment: string): Promise<void> => {
    if (!report) return
    setUpdating(true)
    try {
      const updates: Record<string, string> = { 'Штраф': String(amount) }
      if (comment.trim()) updates['Причина'] = comment.trim()
      const updatedNotes = rebuildNotes(report.notes ?? '', updates)
      await adjustReport(report.id, 'rejected', updatedNotes)
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
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Номер смены" value={parseGet(report.notes ?? '')('Смена', String(report.id))} editable={false} />
          <EditRow icon={<img src="/bus.png" width="20" height="20" />}
            label="Гос.номер ТС" value={parseGet(report.notes ?? '')('Гос.номер', 'X264MP55')} editable={false} />
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>}
            label="Кол-во кругов" value={trips} editable={isPending} onChange={isPending ? markEdited(setTrips) : undefined} />
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
            label="Кол-во карточек" value={cards} editable={isPending} onChange={isPending ? markEdited(setCards) : undefined} />
          <EditRow icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="13 2 13 9 20 9"/><path d="M20 9L13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/></svg>}
            label="Состояние ТС" value={condition} editable={isPending} onChange={isPending ? markEdited(setCondition) : undefined} />

          <div className="row-item" style={{ cursor: 'pointer', background: '#F0F8FF', borderRadius: 10, margin: '4px 0' }}>
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><circle cx="12" cy="13" r="2"/><polyline points="10 15 12 17 14 15"/></svg></OIcon>
            <span className="row-label">Просмотреть чек</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        {isPending && edited && (
          <p style={{ fontSize: 12, color: '#007AFF', textAlign: 'center' }}>✏️ Вы изменили поля — отчёт будет отмечен как «скорректирован»</p>
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
            <button onClick={() => setShowPayModal(true)} disabled={updating}
              style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: '2px solid #34C759', background: 'white', color: '#34C759', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 900 }}>+</span> Начислить<br/>выплату
            </button>
            <button onClick={() => setShowFineModal(true)} disabled={updating}
              style={{ flex: 1, padding: '14px 8px', borderRadius: 50, border: '2px solid #FFB3B3', background: '#FFF5F5', color: '#FF3B30', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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

      {showPayModal && (
        <PayModal recommended={recommended} onConfirm={handlePay} onClose={() => setShowPayModal(false)} />
      )}
      {showFineModal && (
        <FineModal onConfirm={handleFine} onClose={() => setShowFineModal(false)} />
      )}
    </div>
  )
}
