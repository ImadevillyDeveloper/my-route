import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getVehicles, getDrivers, resolveAssetUrl } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'

const abbr = (n: string) => {
  const p = n.trim().split(/\s+/)
  if (p.length < 2 || p[1].includes('.')) return n
  return `${p[0]} ${p[1][0].toUpperCase()}.${p[2] ? p[2][0].toUpperCase() + '.' : ''}`.trim()
}

const VehicleAvatar = ({ url }: { url?: string | null }) => (
  <div style={{ width: 52, height: 52, borderRadius: 14, background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
    {url
      ? <img src={resolveAssetUrl(url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <img src="/bus.png" width="28" height="28" style={{ opacity: 0.35 }} />
    }
  </div>
)

export default function EntVehicles() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers]   = useState<any[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const navigate   = useNavigate()
  const location   = useLocation()
  const filterRoute: string | undefined = (location.state as any)?.filterRoute

  useEffect(() => {
    Promise.all([getVehicles(), getDrivers()])
      .then(([vRes, dRes]) => { setVehicles(vRes.data); setDrivers(dRes.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const driversForVehicle = (plate: string): string => {
    const names = drivers
      .filter((d: any) => d.plate_number === plate)
      .map((d: any) => abbr(d.full_name))
    return names.length > 0 ? names.join(', ') : 'нет водителей'
  }

  const q = search.toLowerCase()
  const filtered = vehicles
    .filter(v => !filterRoute || v.route_number === filterRoute)
    .filter(v => !q ||
      v.plate_number.toLowerCase().includes(q) ||
      (v.model ?? '').toLowerCase().includes(q) ||
      (v.route_number ?? '').toLowerCase().includes(q) ||
      driversForVehicle(v.plate_number).toLowerCase().includes(q)
    )

  const hl = (text: string) => {
    if (!q || !text.toLowerCase().includes(q)) return <>{text}</>
    const idx = text.toLowerCase().indexOf(q)
    return <>{text.slice(0, idx)}<span style={{ color: 'var(--orange)', fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>
  }

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">{filterRoute ? `ТС маршрута ${filterRoute}` : 'Мои ТС'}</span>
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="form-input" placeholder="Найти ТС" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <LogoLoader fullPage />
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 30 }}>
            <div className="empty-icon">🚌</div>
            <div>{search ? 'ТС не найдено' : 'Нет транспортных средств'}</div>
          </div>
        ) : filtered.map(v => (
          <div key={v.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
            onClick={() => navigate(`/entrepreneur/vehicles/${v.id}`)}>
            <VehicleAvatar url={v.avatar_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{hl(v.plate_number)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hl(v.model ?? '—')}
                {v.route_number ? <> · №{hl(v.route_number)}</> : ''}
                {' · '}
                {hl(driversForVehicle(v.plate_number))}
              </div>
            </div>
            <span style={{ color: 'var(--orange)', fontSize: 22 }}>›</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 14px 16px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <button onClick={() => navigate('/entrepreneur/vehicles/add', { state: { presetRoute: filterRoute ?? '' } })}
          style={{ background: 'white', border: '2px solid var(--orange)', borderRadius: 50, padding: '11px 32px', color: 'var(--orange)', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          Добавить
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, lineHeight: 1 }}>+</div>
        </button>
      </div>
    </div>
  )
}
