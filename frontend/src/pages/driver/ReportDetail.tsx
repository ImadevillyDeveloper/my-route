import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport } from '../../api/client'
import StatusBar from '../../components/common/StatusBar'
import LogoLoader from '../../components/common/LogoLoader'
import type { Report } from '../../types'

const OIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{children}</div>
)

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:  { label: 'на проверке',   color: 'var(--text-muted)' },
  approved: { label: 'одобрен',       color: '#34C759' },
  adjusted: { label: 'скорректирован',color: '#007AFF' },
  rejected: { label: 'отклонён',      color: '#FF3B30' },
}

export default function DriverReportDetail() {
  const { id } = useParams()
  const [report, setReport] = useState<Report | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (id) getReport(Number(id)).then(r => setReport(r.data)).catch(() => {})
  }, [id])

  if (!report) return <LogoLoader fullPage />

  const d = new Date(report.shift_date)
  const dateStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`

  const notes = report.notes ?? ''
  const get = (key: string, def: string) => {
    const m = notes.match(new RegExp(`${key}:\\s*([^,]+)`))
    return m ? m[1].trim() : def
  }

  const status = STATUS_MAP[report.status] ?? STATUS_MAP.pending

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Просмотр Отчёта</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Date card */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, background: '#F5F5F5', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Отчёт за</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--orange)', lineHeight: 1.2 }}>{dateStr}</div>
          </div>
        </div>

        {/* Fields */}
        <div className="card">
          <div className="row-item">
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></OIcon>
            <span className="row-label">Номер смены</span>
            <span style={{ color: 'var(--orange)', fontWeight: 700, fontSize: 15 }}>{get('Смена', String(report.id))}</span>
          </div>
          <div className="row-item">
            <OIcon><img src="/bus.png" width="20" height="20" /></OIcon>
            <span className="row-label">Гос.номер ТС</span>
            <span style={{ color: 'var(--orange)', fontWeight: 700, fontSize: 15 }}>{get('Гос.номер', 'X264MP55')}</span>
          </div>
          <div className="row-item">
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg></OIcon>
            <span className="row-label">Кол-во кругов</span>
            <span style={{ color: 'var(--orange)', fontWeight: 700, fontSize: 15 }}>{get('Кругов', String(report.total_trips))}</span>
          </div>
          <div className="row-item">
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></OIcon>
            <span className="row-label">Кол-во карточек</span>
            <span style={{ color: '#007AFF', fontWeight: 700, fontSize: 15 }}>{get('Карточек', '430')}</span>
          </div>
          <div className="row-item">
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></OIcon>
            <span className="row-label">Состояние ТС</span>
            <span style={{ color: '#34C759', fontWeight: 700, fontSize: 15 }}>{get('ТС', 'исправно')}</span>
          </div>

          {/* Просмотреть чек */}
          <div className="row-item" style={{ cursor: 'pointer', background: '#EFF6FF', borderRadius: 10, margin: '4px 0' }}>
            <OIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><circle cx="12" cy="13" r="2"/><polyline points="10 15 12 17 14 15"/></svg>
            </OIcon>
            <span className="row-label">Просмотреть чек</span>
            <span style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        {/* Начисление / штраф */}
        {(report.status !== 'pending') && (() => {
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
                  <span className="row-label">Начисление</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#34C759' }}>+{parseInt(payment).toLocaleString('ru-RU')} ₽</span>
                </div>
              )}
              {fine && (
                <>
                  <div className="row-item" style={{ background: '#FFF0EF', borderRadius: reason ? '10px 10px 0 0' : 10, margin: '4px 0', marginBottom: reason ? 0 : '4px' }}>
                    <div className="row-icon" style={{ background: '#FFD9D7', borderRadius: 8 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </div>
                    <span className="row-label">Штраф</span>
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

        {/* Статус */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Статус:</span>
            <span style={{ fontSize: 15, color: status.color, fontWeight: 600 }}>{status.label}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
