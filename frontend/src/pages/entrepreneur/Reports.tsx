import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getReports, getVehicles } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'
import type { Report } from '../../types'

type PeriodKey = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
type View = 'overview' | 'pending' | 'reviewed'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'all',       label: 'Весь период'    },
  { key: 'today',     label: 'Сегодня'        },
  { key: 'yesterday', label: 'Вчера'          },
  { key: 'week',      label: 'Текущая неделя' },
  { key: 'month',     label: 'Текущий месяц'  },
  { key: 'custom',    label: 'Выбрать период' },
]

const STATUS_CHIPS = [
  { key: 'pending',  label: 'На проверке'   },
  { key: 'approved', label: 'Принят'        },
  { key: 'adjusted', label: 'Скорректирован'},
]

function applyPeriod(reports: Report[], period: PeriodKey, from: string, to: string): Report[] {
  const now        = new Date()
  const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday  = new Date(today); yesterday.setDate(today.getDate() - 1)
  const weekStart  = new Date(today); weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return reports.filter(r => {
    const d = new Date(r.shift_date)
    if (period === 'today')     return d >= today
    if (period === 'yesterday') return d >= yesterday && d < today
    if (period === 'week')      return d >= weekStart
    if (period === 'month')     return d >= monthStart
    if (period === 'custom') {
      if (from && d < new Date(from)) return false
      if (to) { const end = new Date(to); end.setDate(end.getDate() + 1); if (d >= end) return false }
      return true
    }
    return true
  })
}

const fmtDate = (d: string) => {
  const dt = new Date(d)
  const today = new Date()
  if (dt.toDateString() === today.toDateString()) return 'СЕГОДНЯ'
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

const ClockIcon = () => (
  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  </div>
)
const CheckIcon = ({ color }: { color: string }) => (
  <div style={{ width: 52, height: 52, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
)
const AdjustedIcon = () => (
  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  </div>
)
const CrossIcon = () => (
  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </div>
)
const Arrow = () => (
  <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      padding: '6px 13px', borderRadius: 20, cursor: 'pointer',
      border: `1.5px solid ${selected ? 'var(--orange)' : 'var(--border)'}`,
      background: selected ? '#FFF3EE' : 'white',
      color: selected ? 'var(--orange)' : 'var(--text-secondary)',
      fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>{children}</div>
}

export default function EntReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [allVehiclePlates, setAllVehiclePlates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState<View>('overview')
  const navigate = useNavigate()
  const location = useLocation()
  const presetDriver = (location.state as any)?.filterDriver as string | undefined

  // draft filter state — pre-fill from navigation state if present
  const [dStatuses, setDStatuses] = useState<Set<string>>(new Set())
  const [dPeriod,   setDPeriod]   = useState<PeriodKey>('all')
  const [dRoutes,   setDRoutes]   = useState<Set<string>>(new Set())
  const [dDrivers,  setDDrivers]  = useState<Set<string>>(presetDriver ? new Set([presetDriver]) : new Set())
  const [dVehicles, setDVehicles] = useState<Set<string>>(new Set())
  const [dFrom, setDFrom] = useState('')
  const [dTo,   setDTo]   = useState('')

  // applied filter state — auto-apply if came from driver card
  const [aStatuses, setAStatuses] = useState<Set<string>>(new Set())
  const [aPeriod,   setAPeriod]   = useState<PeriodKey>('all')
  const [aRoutes,   setARoutes]   = useState<Set<string>>(new Set())
  const [aDrivers,  setADrivers]  = useState<Set<string>>(presetDriver ? new Set([presetDriver]) : new Set())
  const [aVehicles, setAVehicles] = useState<Set<string>>(new Set())
  const [aFrom, setAFrom] = useState('')
  const [aTo,   setATo]   = useState('')
  const [applied, setApplied] = useState(!!presetDriver)

  useEffect(() => {
    Promise.all([getReports(), getVehicles()]).then(([r, v]) => {
      setReports(r.data)
      setAllVehiclePlates(v.data.map((veh: any) => veh.plate_number).filter(Boolean))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const routes   = [...new Set(reports.map(r => r.route_number ?? '212').filter(Boolean))]
  const drivers  = [...new Set(reports.map(r => r.driver_name ?? 'Водитель').filter(Boolean))]
  const vehicles = allVehiclePlates

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const handleApply = () => {
    setAStatuses(new Set(dStatuses)); setAPeriod(dPeriod)
    setARoutes(new Set(dRoutes));     setADrivers(new Set(dDrivers))
    setAVehicles(new Set(dVehicles))
    setAFrom(dFrom); setATo(dTo); setApplied(true); setFiltersOpen(false)
  }

  const handleReset = () => {
    setDStatuses(new Set()); setDPeriod('all'); setDRoutes(new Set()); setDDrivers(new Set()); setDVehicles(new Set()); setDFrom(''); setDTo('')
    setAStatuses(new Set()); setAPeriod('all'); setARoutes(new Set()); setADrivers(new Set()); setAVehicles(new Set()); setAFrom(''); setATo('')
    setApplied(false)
  }

  // full filtered result
  let filtered = applyPeriod(reports, aPeriod, aFrom, aTo)
  if (aStatuses.size  > 0) filtered = filtered.filter(r => aStatuses.has(r.status))
  if (aRoutes.size    > 0) filtered = filtered.filter(r => aRoutes.has(r.route_number ?? '212'))
  if (aDrivers.size   > 0) filtered = filtered.filter(r => aDrivers.has(r.driver_name ?? 'Водитель'))
  if (aVehicles.size  > 0) filtered = filtered.filter(r => r.plate_number && aVehicles.has(r.plate_number))

  const sortByReviewed = (list: Report[]) =>
    [...list].sort((a, b) => {
      const ta = a.reviewed_at ? new Date(a.reviewed_at).getTime() : 0
      const tb = b.reviewed_at ? new Date(b.reviewed_at).getTime() : 0
      return tb - ta
    })

  const allPending  = reports.filter(r => r.status === 'pending')
  const allReviewed = sortByReviewed(reports.filter(r => r.status !== 'pending'))

  const displayPending  = applied ? filtered.filter(r => r.status === 'pending')                        : allPending.slice(0, 4)
  const displayReviewed = applied ? sortByReviewed(filtered.filter(r => r.status !== 'pending'))        : allReviewed.slice(0, 4)
  const isEmpty = applied && filtered.length === 0
  const hasActive = applied && (aStatuses.size > 0 || aPeriod !== 'all' || aRoutes.size > 0 || aDrivers.size > 0 || aVehicles.size > 0)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const ReportCard = ({ r }: { r: Report }) => {
    const isPending  = r.status === 'pending'
    const isApproved = r.status === 'approved'
    const isAdjusted = r.status === 'adjusted'
    return (
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: isPending ? '#FFF8F5' : 'white', marginBottom: 6 }}
        onClick={() => navigate(`/entrepreneur/reports/${r.id}`)}>
        {isPending ? <ClockIcon /> : isApproved ? <CheckIcon color="#34C759" /> : isAdjusted ? <AdjustedIcon /> : <CrossIcon />}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{r.driver_name ?? 'Водитель'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {fmtDate(r.shift_date)} · {r.route_number ?? '212'}{r.plate_number ? ` · ${r.plate_number}` : ''}
          </div>
        </div>
        {isAdjusted && <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF', background: '#EFF6FF', borderRadius: 20, padding: '2px 7px', flexShrink: 0 }}>корр.</span>}
        <span style={{ color: 'var(--orange)', fontSize: 22 }}>›</span>
      </div>
    )
  }

  // ── PENDING VIEW ──────────────────────────────────────────────────
  if (view === 'pending') {
    return (
      <div className="page-flexcol">
        <div className="app-header">
          <button className="app-header-back" onClick={() => setView('overview')}>←</button>
          <span className="app-header-title">Ожидают проверки</span>
          <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '2px 10px', color: 'white', fontWeight: 700, fontSize: 13 }}>{allPending.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', paddingBottom: 'calc(var(--nav-safe) + 10px)' }}>
          {allPending.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 30 }}>
              <div className="empty-icon">📋</div>
              <div>Отчётов на проверке нет</div>
            </div>
          ) : allPending.map(r => <ReportCard key={r.id} r={r} />)}
        </div>
      </div>
    )
  }

  // ── REVIEWED VIEW ─────────────────────────────────────────────────
  if (view === 'reviewed') {
    return (
      <div className="page-flexcol">
        <div className="app-header">
          <button className="app-header-back" onClick={() => setView('overview')}>←</button>
          <span className="app-header-title">Проверенные отчёты</span>
          <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '2px 10px', color: 'white', fontWeight: 700, fontSize: 13 }}>{allReviewed.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', paddingBottom: 'calc(var(--nav-safe) + 10px)' }}>
          {allReviewed.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 30 }}>
              <div className="empty-icon">✅</div>
              <div>Проверенных отчётов нет</div>
            </div>
          ) : sortByReviewed(allReviewed).map(r => <ReportCard key={r.id} r={r} />)}
        </div>
      </div>
    )
  }

  // ── OVERVIEW VIEW ─────────────────────────────────────────────────
  return (
    <div className="page-flexcol">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои Отчёты</span>
      </div>

      {/* Collapsible filter bar */}
      <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid var(--border)' }}>
        {/* Header row — always visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
          <button onClick={() => setFiltersOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: filtersOpen ? '#FFF3EE' : 'white', border: `1.5px solid ${filtersOpen ? 'var(--orange)' : 'var(--border)'}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', color: filtersOpen ? 'var(--orange)' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Фильтры {filtersOpen ? '▴' : '▾'}
          </button>

          {/* Active filter badges */}
          <div style={{ display: 'flex', gap: 5, flex: 1, overflow: 'hidden' }}>
            {aStatuses.size > 0 && [...aStatuses].map(s => (
              <span key={s} style={{ background: '#FFF3EE', color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {STATUS_CHIPS.find(c => c.key === s)?.label}
              </span>
            ))}
            {aPeriod !== 'all' && (
              <span style={{ background: '#FFF3EE', color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {PERIOD_OPTIONS.find(o => o.key === aPeriod)?.label}
              </span>
            )}
          </div>

          {(applied || hasActive) && (
            <button onClick={handleReset} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0, padding: '4px' }}>
              Сбросить
            </button>
          )}
        </div>

        {/* Expanded filter content */}
        {filtersOpen && (
          <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)' }}>
            {/* Статус */}
            <FilterLabel>Статус</FilterLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {STATUS_CHIPS.map(s => (
                <Chip key={s.key} label={s.label} selected={dStatuses.has(s.key)}
                  onToggle={() => toggleSet(setDStatuses, s.key)} />
              ))}
            </div>

            {/* Период */}
            <FilterLabel>Период</FilterLabel>
            <div style={{ position: 'relative', marginBottom: dPeriod === 'custom' ? 8 : 10 }}>
              <select className="form-input" style={{ padding: '8px 32px 8px 12px', fontSize: 13, appearance: 'none', cursor: 'pointer', width: '100%' }}
                value={dPeriod} onChange={e => setDPeriod(e.target.value as PeriodKey)}>
                {PERIOD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <Arrow />
            </div>
            {dPeriod === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <input type="date" value={dFrom} onChange={e => setDFrom(e.target.value)}
                  className="form-input" style={{ flex: 1, padding: '8px 10px', fontSize: 13 }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>—</span>
                <input type="date" value={dTo} onChange={e => setDTo(e.target.value)}
                  className="form-input" style={{ flex: 1, padding: '8px 10px', fontSize: 13 }} />
              </div>
            )}

            {/* Маршрут */}
            {routes.length > 0 && (
              <>
                <FilterLabel>Маршрут</FilterLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {routes.map(r => (
                    <Chip key={r} label={`№${r}`} selected={dRoutes.has(r)}
                      onToggle={() => toggleSet(setDRoutes, r)} />
                  ))}
                </div>
              </>
            )}

            {/* Водитель */}
            {drivers.length > 0 && (
              <>
                <FilterLabel>Водитель</FilterLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {drivers.map(d => (
                    <Chip key={d} label={d} selected={dDrivers.has(d)}
                      onToggle={() => toggleSet(setDDrivers, d)} />
                  ))}
                </div>
              </>
            )}

            {/* ТС */}
            {vehicles.length > 0 && (
              <>
                <FilterLabel>ТС</FilterLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {vehicles.map(p => (
                    <Chip key={p} label={p} selected={dVehicles.has(p)}
                      onToggle={() => toggleSet(setDVehicles, p)} />
                  ))}
                </div>
              </>
            )}

            <button onClick={handleApply} className="btn btn-primary" style={{ borderRadius: 50, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              Применить
            </button>
          </div>
        )}
      </div>

      {/* Scrollable reports */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', paddingBottom: 'calc(var(--nav-safe) + 10px)' }}>
        {loading ? (
          <LogoLoader fullPage />
        ) : isEmpty ? (
          <div className="empty-state" style={{ marginTop: 20 }}>
            <div className="empty-icon">📋</div>
            <div style={{ fontWeight: 600 }}>Отчётов не найдено</div>
            <button onClick={handleReset} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--orange)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Сбросить фильтры</button>
          </div>
        ) : (
          <>
            {/* Pending section */}
            {(applied ? displayPending.length > 0 : allPending.length > 0) && (
              <>
                <div onClick={() => setView('pending')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px 8px', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Ожидают проверки</span>
                  <span style={{ background: 'var(--orange)', color: 'white', borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{allPending.length}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--orange)', fontSize: 20 }}>›</span>
                </div>
                {displayPending.map(r => <ReportCard key={r.id} r={r} />)}
                {!applied && allPending.length > 4 && (
                  <div onClick={() => setView('pending')} style={{ textAlign: 'center', padding: '6px', color: 'var(--orange)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    Ещё {allPending.length - 4} →
                  </div>
                )}
              </>
            )}

            {/* Reviewed section */}
            {(applied ? displayReviewed.length > 0 : allReviewed.length > 0) && (
              <>
                <div onClick={() => setView('reviewed')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px 8px', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Недавно проверенные</span>
                  {applied && <span style={{ background: '#34C759', color: 'white', borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{displayReviewed.length}</span>}
                  <span style={{ marginLeft: 'auto', color: 'var(--orange)', fontSize: 20 }}>›</span>
                </div>
                {displayReviewed.map(r => <ReportCard key={r.id} r={r} />)}
                {!applied && allReviewed.length > 4 && (
                  <div onClick={() => setView('reviewed')} style={{ textAlign: 'center', padding: '6px', color: 'var(--orange)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    Ещё {allReviewed.length - 4} →
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
