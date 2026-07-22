import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReports } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'
import type { Report } from '../../types'

type PeriodKey = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
type StatusKey = 'all' | 'pending' | 'approved' | 'adjusted' | 'rejected'
type TypeKey   = 'all' | 'income' | 'fine'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'all',       label: 'За всё время'   },
  { key: 'today',     label: 'Сегодня'        },
  { key: 'yesterday', label: 'Вчера'          },
  { key: 'week',      label: 'Текущая неделя' },
  { key: 'month',     label: 'Текущий месяц'  },
  { key: 'custom',    label: 'Выбрать период' },
]

const STATUS_OPTIONS: { key: StatusKey; label: string; icon: React.ReactNode }[] = [
  { key: 'all',       label: 'Все',            icon: <CircleCheck color="var(--orange)" /> },
  { key: 'pending',   label: 'В обработке',    icon: <CircleClock /> },
  { key: 'approved',  label: 'Принят',         icon: <CircleCheck color="#34C759" /> },
  { key: 'adjusted',  label: 'Скорректирован', icon: <CircleCheck color="#007AFF" /> },
  { key: 'rejected',  label: 'Отклонён',       icon: <CircleCheck color="var(--danger)" /> },
]

const TYPE_OPTIONS: { key: TypeKey; label: string; icon: React.ReactNode }[] = [
  { key: 'all',    label: 'Все типы',   icon: <CircleInfo color="var(--orange)" /> },
  { key: 'income', label: 'Начисления', icon: <CirclePlus /> },
  { key: 'fine',   label: 'Штрафы',     icon: <CircleMinus /> },
]

function CircleCheck({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.15"/>
      <polyline points="8 12 11 15 16 9" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function CircleClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#888" opacity="0.15"/>
      <polyline points="12 7 12 12 15 14" stroke="#888" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function CircleInfo({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.15"/>
      <line x1="12" y1="11" x2="12" y2="17" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="12" cy="8" r="1" fill={color}/>
    </svg>
  )
}
function CirclePlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#34C759" opacity="0.15"/>
      <line x1="12" y1="8" x2="12" y2="16" stroke="#34C759" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="#34C759" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}
function CircleMinus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#FF3B30" opacity="0.15"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="#FF3B30" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}
function CircleX({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.15"/>
      <line x1="9" y1="9" x2="15" y2="15" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="15" y1="9" x2="9" y2="15" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}
function CalendarIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--orange)' : '#888'
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'approved') return <CircleCheck color="#34C759" />
  if (status === 'adjusted') return <CircleCheck color="#007AFF" />
  if (status === 'rejected') return <CircleX color="var(--danger)" />
  return <CircleClock />
}

function filterByPeriod(reports: Report[], period: PeriodKey, from: string, to: string): Report[] {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
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

export default function DriverShifts() {
  const [tab, setTab]             = useState<'reports' | 'salary'>('reports')
  const [reports, setReports]     = useState<Report[]>([])
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)

  const [periodFilter, setPeriodFilter] = useState<PeriodKey>('all')
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all')
  const [typeFilter, setTypeFilter]     = useState<TypeKey>('all')
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [openDrop, setOpenDrop]         = useState<'period' | 'status' | 'type' | null>(null)

  const filterRef = useRef<HTMLDivElement>(null)
  const PER_PAGE = 8
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getReports().then(r => setReports(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // close dropdown on outside click
  useEffect(() => {
    if (!openDrop) return
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenDrop(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDrop])

  const toggle = (key: 'period' | 'status' | 'type') =>
    setOpenDrop(p => p === key ? null : key)

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getFullYear()).slice(2)}`
  }

  const PERIOD_LABEL = PERIOD_OPTIONS.find(o => o.key === periodFilter)?.label ?? 'Период'
  const STATUS_LABEL = STATUS_OPTIONS.find(o => o.key === statusFilter)?.label ?? 'Статус'
  const TYPE_LABEL   = TYPE_OPTIONS.find(o => o.key === typeFilter)?.label ?? 'Тип'

  // apply filters
  let filteredReports = filterByPeriod(reports, periodFilter, customFrom, customTo)
  if (statusFilter !== 'all') filteredReports = filteredReports.filter(r => r.status === statusFilter)

  // Парсим начисления и штрафы из notes каждого отчёта
  const parseNote = (notes: string | null, key: string): number | null => {
    if (!notes) return null
    const m = notes.match(new RegExp(`${key}:\\s*([\\d.]+)`))
    return m ? parseFloat(m[1]) : null
  }

  type SalaryRow = { r: Report; amount: number; isNegative: boolean; comment: string }
  const salaryRows: SalaryRow[] = reports.flatMap(r => {
    const rows: SalaryRow[] = []
    const payment = parseNote(r.notes ?? null, 'Выплата')
    const fine    = parseNote(r.notes ?? null, 'Штраф')
    const reason  = (() => { const m = (r.notes ?? '').match(/Причина:\s*([^,]+)/); return m ? m[1].trim() : '' })()
    if (payment && payment > 0) rows.push({ r, amount: payment, isNegative: false, comment: '' })
    if (fine    && fine    > 0) rows.push({ r, amount: fine,    isNegative: true,  comment: reason })
    return rows
  })

  // Фильтруем сами строки (а не коллапсируем в отчёты и обратно) — иначе у
  // отчёта с ОДНОВРЕМЕННО выплатой и штрафом обе строки схлопывались в одну
  // (всегда возвращалась первая попавшаяся по id — выплата), и найти штраф
  // было невозможно ни в списке "Все", ни тем более через фильтр "Штрафы".
  const filteredSalary = salaryRows
    .filter(x => typeFilter === 'all' || (typeFilter === 'income' ? !x.isNegative : x.isNegative))
    .filter(x => filterByPeriod([x.r], periodFilter, customFrom, customTo).length > 0)

  // Сводка за выбранный период — считается только по периоду, независимо от
  // фильтра "Тип", чтобы всегда показывать полную картину (начисления, штрафы,
  // итог), даже когда список ниже отфильтрован на один тип.
  const periodSalaryRows = salaryRows.filter(x => filterByPeriod([x.r], periodFilter, customFrom, customTo).length > 0)
  const totalIncome = periodSalaryRows.filter(x => !x.isNegative).reduce((s, x) => s + x.amount, 0)
  const totalFines  = periodSalaryRows.filter(x => x.isNegative).reduce((s, x) => s + x.amount, 0)
  const totalNet    = totalIncome - totalFines

  const totalPages = Math.ceil(filteredReports.length / PER_PAGE)
  const paged = filteredReports.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 20,
    border: `1.5px solid ${active ? 'var(--orange)' : 'var(--border)'}`,
    background: active ? '#FFF3EE' : 'white',
    color: active ? 'var(--orange)' : 'var(--text-secondary)',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  })

  const dropStyle: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
    background: 'white', borderRadius: 16, minWidth: 220,
    boxShadow: '0 6px 28px rgba(0,0,0,0.13)',
    overflow: 'hidden',
  }

  const dropRow = (selected: boolean, icon: React.ReactNode, label: string, onClick: () => void) => (
    <div key={label} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px', cursor: 'pointer',
      background: selected ? '#FFF3EE' : 'transparent',
      borderBottom: '1px solid #F5F5F5',
    }}>
      {icon}
      <span style={{ fontSize: 15, fontWeight: selected ? 700 : 500, color: selected ? 'var(--orange)' : 'var(--text-primary)' }}>{label}</span>
    </div>
  )

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои Смены</span>
      </div>

      {/* Title + tabs */}
      <div style={{ background: 'white', padding: '14px 16px 0' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
          {tab === 'reports' ? 'Мои Отчёты' : 'Мои Начисления'}
        </h2>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button className={`tab-btn${tab === 'reports' ? ' active' : ''}`} onClick={() => { setTab('reports'); setPage(1) }}>Отчёты</button>
          <button className={`tab-btn${tab === 'salary' ? ' active' : ''}`} onClick={() => { setTab('salary'); setPage(1) }}>Начисления</button>
        </div>
      </div>

      {/* Filters */}
      <div ref={filterRef} style={{ background: 'white', padding: '10px 16px', display: 'flex', gap: 8, position: 'relative' }}>
        {/* Period chip */}
        <button style={chipStyle(periodFilter !== 'all')} onClick={() => toggle('period')}>
          <CalendarIcon active={periodFilter !== 'all'} />
          {periodFilter !== 'all' ? PERIOD_LABEL : 'Период'} ▾
        </button>

        {/* Status / Type chip */}
        {tab === 'reports' ? (
          <button style={chipStyle(statusFilter !== 'all')} onClick={() => toggle('status')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={statusFilter !== 'all' ? 'var(--orange)' : 'currentColor'} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {statusFilter !== 'all' ? STATUS_LABEL : 'Статус'} ▾
          </button>
        ) : (
          <button style={chipStyle(typeFilter !== 'all')} onClick={() => toggle('type')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={typeFilter !== 'all' ? 'var(--orange)' : 'currentColor'} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            {typeFilter !== 'all' ? TYPE_LABEL : 'Тип'} ▾
          </button>
        )}

        {/* Period dropdown */}
        {openDrop === 'period' && (
          <div style={dropStyle}>
            {PERIOD_OPTIONS.map(opt =>
              dropRow(
                periodFilter === opt.key,
                <CalendarIcon active={periodFilter === opt.key} />,
                opt.label,
                () => { setPeriodFilter(opt.key); if (opt.key !== 'custom') setOpenDrop(null); setPage(1) }
              )
            )}
            {periodFilter === 'custom' && (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #F0F0F0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--text-primary)' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--text-primary)' }} />
                </div>
                <button onClick={() => { setOpenDrop(null); setPage(1) }}
                  style={{ width: '100%', padding: '10px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Применить
                </button>
              </div>
            )}
          </div>
        )}

        {/* Status dropdown */}
        {openDrop === 'status' && (
          <div style={{ ...dropStyle, left: 'auto', right: 'auto' }}>
            {STATUS_OPTIONS.map(opt =>
              dropRow(statusFilter === opt.key, opt.icon, opt.label, () => { setStatusFilter(opt.key); setOpenDrop(null); setPage(1) })
            )}
          </div>
        )}

        {/* Type dropdown */}
        {openDrop === 'type' && (
          <div style={{ ...dropStyle, left: 'auto', right: 'auto' }}>
            {TYPE_OPTIONS.map(opt =>
              dropRow(typeFilter === opt.key, opt.icon, opt.label, () => { setTypeFilter(opt.key); setOpenDrop(null); setPage(1) })
            )}
          </div>
        )}
      </div>

      {tab === 'reports' ? (
        loading ? (
          <LogoLoader fullPage />
        ) : (
          <>
            <div className="card" style={{ margin: '12px 14px', borderRadius: 12 }}>
              {paged.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📋</div><div>Отчётов нет</div></div>
              ) : paged.map(r => (
                <div key={r.id} className="report-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/driver/report/${r.id}`)}>
                  <span className="report-row-title">Отчёт за <span>{formatDate(r.shift_date)}</span></span>
                  <StatusIcon status={r.status} />
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px' }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' }}>‹</button>
                {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: page === p ? 'var(--orange)' : 'transparent', color: page === p ? 'white' : 'var(--text-secondary)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{p}</button>
                ))}
                {totalPages > 4 && <span style={{ color: 'var(--text-muted)' }}>...</span>}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' }}>›</button>
              </div>
            )}
          </>
        )
      ) : loading ? (
        <LogoLoader fullPage />
      ) : (
        <>
          <div className="card" style={{ margin: '12px 14px 0', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Начислено</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#34C759' }}>+{totalIncome.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Штрафы</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>−{totalFines.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Итого</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--orange)' }}>{totalNet.toLocaleString('ru-RU')} ₽</div>
            </div>
          </div>
          <div className="card" style={{ margin: '12px 14px', borderRadius: 12 }}>
            {filteredSalary.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">💳</div><div>Начислений нет</div></div>
            ) : filteredSalary.map(({ r, amount, isNegative, comment }) => (
              <div key={`${r.id}-${isNegative ? 'f' : 'p'}`} className="report-row"
                style={{ cursor: 'pointer' }} onClick={() => navigate(`/driver/report/${r.id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isNegative ? <CircleMinus /> : <CirclePlus />}
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {isNegative ? 'Штраф' : 'Начисление'}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {formatDate(r.shift_date)}
                    </span>
                  </div>
                  {comment && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, paddingLeft: 26 }}>
                      {comment}
                    </div>
                  )}
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, flexShrink: 0,
                  color: isNegative ? 'var(--danger)' : '#34C759' }}>
                  {isNegative ? '−' : '+'}{amount.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
