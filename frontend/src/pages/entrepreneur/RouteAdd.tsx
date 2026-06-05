import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoute } from '../../api/client'
import StatusBar from '../../components/common/StatusBar'
import { capitalizeFirst, formatCert } from '../../utils/format'

const CheckCircle = () => (
  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
)

export default function EntRouteAdd() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ number: '', end1: '', end2: '', cert: '' })
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const s = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  const sEnd = (k: 'end1'|'end2') => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: capitalizeFirst(e.target.value) }))
  const sCert = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, cert: formatCert(e.target.value) }))

  const submit = async () => {
    if (!form.number.trim()) { setError('Укажите номер маршрута'); return }
    setError('')
    await createRoute({ number: form.number.trim(), name: `Маршрут ${form.number.trim()}`, start_point: form.end1, end_point: form.end2, document_number: form.cert }).catch(() => {})
    setShowSuccess(true)
  }

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Добавление Маршрута</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Top card */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {/* Route circle */}
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>
              {form.number || '№'}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Данные маршрута *</div>
              <input className="form-input" placeholder="Номер" value={form.number} onChange={s('number')} style={{ padding: '8px 12px', fontSize: 14 }} />
              <input className="form-input" placeholder="Конечная 1" value={form.end1} onChange={sEnd('end1')} style={{ padding: '8px 12px', fontSize: 14 }} />
              <input className="form-input" placeholder="Конечная 2" value={form.end2} onChange={sEnd('end2')} style={{ padding: '8px 12px', fontSize: 14 }} />
            </div>
          </div>
        </div>

        {/* Свидетельство / Парк */}
        <div className="card">
          <div className="row-item">
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <span className="row-label">Свидетельство</span>
            <input className="row-input" placeholder="00 123456" value={form.cert} onChange={sCert} />
          </div>
          <div className="row-item">
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span className="row-label">Парк</span>
            <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14 }}>ИП Черепанов В.Г.</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FFF0F0', border: '1.5px solid #FFB3B3', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#CC3333', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button onClick={submit} style={{ marginTop: 8, padding: '16px 24px', borderRadius: 16, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
          <CheckCircle />
          <span style={{ flex: 1, textAlign: 'center', letterSpacing: 0.5 }}>ДОБАВИТЬ МАРШРУТ</span>
          <span style={{ fontSize: 22 }}>›</span>
        </button>
      </div>

      {/* Success modal */}
      {showSuccess && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '32px 28px 28px', width: '100%', maxWidth: 340, position: 'relative', textAlign: 'center' }}>
            <button onClick={() => navigate('/entrepreneur/routes')} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>

            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 36 36" fill="none" stroke="var(--orange)" strokeWidth="1.5">
                  <circle cx="10" cy="28" r="3.5" fill="var(--orange)" stroke="none"/>
                  <circle cx="26" cy="8" r="3.5" fill="var(--orange)" stroke="none"/>
                  <path d="M10 28 Q18 18 26 8" strokeDasharray="3 2"/>
                  <circle cx="32" cy="14" r="5" fill="var(--orange)" stroke="none"/>
                  <polyline points="29.5 14 31.5 16 34.5 11" stroke="white" strokeWidth="1.5" fill="none"/>
                </svg>
              </div>
              <span style={{ position: 'absolute', top: -4, right: -4, color: 'var(--orange)', fontSize: 14, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', top: 10, left: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: 0, right: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: -4, left: -4, color: 'var(--orange)', fontSize: 10, fontWeight: 700 }}>+</span>
            </div>

            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Маршрут добавлен!</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
              С ним можно связать<br />Водителей и ТС.
            </div>

            <button onClick={() => navigate('/entrepreneur/routes')}
              style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
            >Готово</button>
          </div>
        </div>
      )}
    </div>
  )
}
