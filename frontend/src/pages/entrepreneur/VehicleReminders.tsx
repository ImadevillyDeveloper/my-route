import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getVehicleMaintenance, updateMaintenance, getVehicleInsurance } from '../../api/client'
import StatusBar from '../../components/common/StatusBar'

type ReminderKey = 'kasko' | 'osago' | 'to'
interface ReminderConfig { enabled: boolean; daysBefore: number[] }
type RemindersState = Record<ReminderKey, ReminderConfig>

const DAYS_OPTIONS = [3, 7, 14, 30, 60]
const DEFAULTS: RemindersState = {
  kasko: { enabled: true,  daysBefore: [30, 7] },
  osago: { enabled: true,  daysBefore: [14, 3] },
  to:    { enabled: false, daysBefore: [] },
}
const LABELS: Record<ReminderKey, string> = { kasko: 'КАСКО', osago: 'ОСАГО', to: 'Техосмотр' }

const parseDeadline = (iso: string | null | undefined): Date | null => {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}
const daysUntil = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86400000)
const deadlineLabel = (iso: string | null | undefined): { text: string; color: string } => {
  const d = parseDeadline(iso)
  if (!d) return { text: 'не указан', color: 'var(--text-muted)' }
  const days = daysUntil(d)
  const fmt = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
  if (days < 0)   return { text: `просрочен ${Math.abs(days)} дн. назад`, color: '#FF3B30' }
  if (days <= 30) return { text: `${days} дн. осталось`, color: '#FF9500' }
  return { text: `до ${fmt}`, color: '#34C759' }
}

const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <div onClick={onToggle} style={{ width: 44, height: 26, borderRadius: 13, background: on ? 'var(--orange)' : '#D1D1D6', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
    <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
  </div>
)

const ICONS: Record<ReminderKey, React.ReactNode> = {
  kasko: <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  osago: <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  to:    <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
}

export default function VehicleReminders() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reminders, setReminders] = useState<RemindersState>(DEFAULTS)
  const [deadlines, setDeadlines] = useState<{ kasko: string | null; osago: string | null; to: string | null }>({ kasko: null, osago: null, to: null })

  useEffect(() => {
    if (!id) return
    Promise.all([
      getVehicleMaintenance(Number(id)).catch(() => ({ data: null })),
      getVehicleInsurance(Number(id)).catch(() => ({ data: null })),
    ]).then(([maintRes, insRes]) => {
      const maint = maintRes.data
      const ins   = insRes.data
      if (maint?.reminders_json) {
        try { setReminders({ ...DEFAULTS, ...JSON.parse(maint.reminders_json) }) } catch {}
      }
      setDeadlines({
        kasko: ins?.kasko_end_date ?? null,
        osago: ins?.end_date       ?? null,
        to:    maint?.next_date    ?? null,
      })
    })
  }, [id])

  const saveReminders = (next: RemindersState) => {
    setReminders(next)
    if (!id) return
    updateMaintenance(Number(id), { reminders_json: JSON.stringify(next) }).catch(() => {})
  }

  const toggle    = (key: ReminderKey) =>
    saveReminders({ ...reminders, [key]: { ...reminders[key], enabled: !reminders[key].enabled } })

  const toggleDay = (key: ReminderKey, day: number) => {
    const prev = reminders[key].daysBefore
    const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    saveReminders({ ...reminders, [key]: { ...reminders[key], daysBefore: next } })
  }

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Напоминания</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 2px', lineHeight: 1.5 }}>
          Уведомления придут в приложение за выбранное количество дней до истечения срока.
        </p>

        {(['kasko', 'osago', 'to'] as ReminderKey[]).map(key => {
          const cfg = reminders[key]
          const dl  = deadlineLabel(deadlines[key])
          return (
            <div key={key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8, flexShrink: 0 }}>{ICONS[key]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{LABELS[key]}</div>
                  <div style={{ fontSize: 12, color: dl.color, fontWeight: 600, marginTop: 2 }}>{dl.text}</div>
                </div>
                <Toggle on={cfg.enabled} onToggle={() => toggle(key)} />
              </div>

              {cfg.enabled && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Уведомить за</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {DAYS_OPTIONS.map(d => {
                      const selected = cfg.daysBefore.includes(d)
                      return (
                        <button key={d} onClick={() => toggleDay(key, d)} style={{
                          padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                          border: `1.5px solid ${selected ? 'var(--orange)' : 'var(--border)'}`,
                          background: selected ? '#FFF3EE' : 'white',
                          color: selected ? 'var(--orange)' : 'var(--text-secondary)',
                        }}>
                          {d} дн.
                        </button>
                      )
                    })}
                  </div>
                  {cfg.daysBefore.length === 0 && (
                    <div style={{ fontSize: 12, color: '#FF9500', marginTop: 8 }}>Выберите хотя бы один срок</div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Активные напоминания</div>
          {(['kasko', 'osago', 'to'] as ReminderKey[]).map(key => {
            const cfg = reminders[key]
            if (!cfg.enabled || cfg.daysBefore.length === 0) return null
            const sorted = [...cfg.daysBefore].sort((a, b) => b - a)
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{LABELS[key]}</span>{' — за '}
                  {sorted.map((d, i) => <span key={d}>{i > 0 ? ', ' : ''}<span style={{ color: 'var(--orange)', fontWeight: 600 }}>{d}</span> дн.</span>)}
                </span>
              </div>
            )
          })}
          {(['kasko', 'osago', 'to'] as ReminderKey[]).every(k => !reminders[k].enabled || reminders[k].daysBefore.length === 0) && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Нет активных напоминаний</div>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Сроки документов берутся из карточки ТС и сохраняются автоматически
        </p>
      </div>
    </div>
  )
}
