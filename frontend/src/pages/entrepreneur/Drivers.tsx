import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getDrivers, resolveAssetUrl } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'

interface Driver {
  id: number
  full_name: string
  driver_id: string | null
  phone: string | null
  route_number: string | null
  plate_number: string | null
  avatar_url: string | null
}

const DriverAvatar = ({ url }: { url: string | null }) => (
  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFF3EE', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {url
      ? <img src={resolveAssetUrl(url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    }
  </div>
)

const abbr = (n: string) => {
  const p = n.trim().split(/\s+/)
  if (p.length < 2) return n
  return `${p[0]} ${p[1][0].toUpperCase()}.${p[2] ? p[2][0].toUpperCase() + '.' : ''}`.trim()
}

export default function EntDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const filterRoute: string | undefined = (location.state as any)?.filterRoute

  useEffect(() => {
    getDrivers()
      .then(r => setDrivers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const q = search.toLowerCase()
  const filtered = drivers
    .filter(d => !filterRoute || d.route_number === filterRoute)
    .filter(d => !q ||
      d.full_name.toLowerCase().includes(q) ||
      (d.driver_id ?? '').toLowerCase().includes(q) ||
      (d.route_number ?? '').toLowerCase().includes(q) ||
      (d.plate_number ?? '').toLowerCase().includes(q)
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
        <span className="app-header-title">{filterRoute ? `Водители маршрута ${filterRoute}` : 'Мои Водители'}</span>
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="form-input" placeholder="Найти водителя" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <LogoLoader fullPage />
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 30 }}>
            <div className="empty-icon">👤</div>
            <div>{search ? 'Водитель не найден' : 'Нет водителей'}</div>
          </div>
        ) : filtered.map(d => (
          <div key={d.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
            onClick={() => navigate(`/entrepreneur/drivers/${d.id}`)}>
            <DriverAvatar url={d.avatar_url} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{hl(abbr(d.full_name))}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                {hl(d.driver_id ?? '—')} · №{hl(d.route_number ?? '—')} · {hl(d.plate_number ?? '—')}
              </div>
            </div>
            <span style={{ color: 'var(--orange)', fontSize: 22 }}>›</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 14px 16px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <button onClick={() => navigate('/entrepreneur/drivers/add', { state: { presetRoute: filterRoute ?? '' } })}
          style={{ background: 'white', border: '2px solid var(--orange)', borderRadius: 50, padding: '11px 32px', color: 'var(--orange)', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          Добавить
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, lineHeight: 1 }}>+</div>
        </button>
      </div>
    </div>
  )
}
