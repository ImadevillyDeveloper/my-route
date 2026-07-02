import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVehicles, getDrivers } from '../../api/client'
import { getRoutesWithOverrides } from '../../api/routes'
import LogoLoader from '../../components/common/LogoLoader'

export default function EntRoutes() {
  const [routes, setRoutes]           = useState<any[]>([])
  const [totalByRoute, setTotalByRoute]   = useState<Record<string, number>>({})
  const [driversByRoute, setDriversByRoute] = useState<Record<string, number>>({})
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getRoutesWithOverrides(), getVehicles(), getDrivers()])
      .then(([routes, vRes, dRes]) => {
        setRoutes(routes)

        // Кол-во ТС по маршруту
        const total: Record<string, number> = {}
        for (const v of vRes.data) {
          if (v.route_number) total[v.route_number] = (total[v.route_number] ?? 0) + 1
        }
        setTotalByRoute(total)

        // Кол-во водителей по маршруту (у кого route_number совпадает)
        const driverCnt: Record<string, number> = {}
        for (const d of dRes.data) {
          if (d.route_number) driverCnt[d.route_number] = (driverCnt[d.route_number] ?? 0) + 1
        }
        setDriversByRoute(driverCnt)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const q = search.toLowerCase()
  const filtered = routes.filter(r => !q ||
    r.number.toLowerCase().includes(q) ||
    (r.start_point ?? '').toLowerCase().includes(q) ||
    (r.end_point ?? '').toLowerCase().includes(q)
  )

  const hl = (text: string) => {
    if (!q || !text?.toLowerCase().includes(q)) return <>{text}</>
    const idx = text.toLowerCase().indexOf(q)
    return <>{text.slice(0, idx)}<span style={{ color: 'var(--orange)', fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>
  }

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои Маршруты</span>
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="form-input" placeholder="Найти маршрут" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <LogoLoader fullPage />
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 30 }}>
            <div className="empty-icon">🚌</div>
            <div>{search ? 'Маршрут не найден' : 'Нет маршрутов'}</div>
          </div>
        ) : filtered.map(r => {
          const total   = totalByRoute[r.number]   ?? 0
          const drivers = driversByRoute[r.number] ?? 0
          return (
            <div key={r.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
              onClick={() => navigate(`/entrepreneur/routes/${r.id}`)}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                {hl(r.number)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Маршрут №{hl(r.number)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {hl(r.start_point ?? '')} → {hl(r.end_point ?? '')}
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  <span style={{ color: total > 0 ? 'var(--orange)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {total === 0 ? 'Нет ТС' : `${total} ТС`}
                  </span>
                  {drivers > 0 && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {drivers} вод.</span>
                  )}
                </div>
              </div>
              <span style={{ color: 'var(--orange)', fontSize: 22 }}>›</span>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '4px 14px 16px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <button onClick={() => navigate('/entrepreneur/routes/add')}
          style={{ background: 'white', border: '2px solid var(--orange)', borderRadius: 50, padding: '11px 32px', color: 'var(--orange)', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          Добавить
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, lineHeight: 1 }}>+</div>
        </button>
      </div>
    </div>
  )
}
