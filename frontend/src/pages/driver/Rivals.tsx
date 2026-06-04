import { useEffect, useState } from 'react'
import { getRivals } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'
import type { RivalVehicle } from '../../types'

const DIRECTIONS = ['', 'Центр → ОмскТех', 'ОмскТех → Центр', 'Центр → Левый берег', 'Левый берег → Центр']

export default function DriverRivals() {
  const [rivals, setRivals] = useState<RivalVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getRivals(direction || undefined)
      setRivals(res.data)
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [direction])

  const getSpeedColor = (speed: number) => {
    if (speed > 55) return 'var(--danger)'
    if (speed > 35) return 'var(--warning)'
    return 'var(--success)'
  }

  return (
    <div>
      <div className="orange-header">
        <h1>🚌 Конкуренты</h1>
        <p>{rivals.length} конкурентов на маршруте</p>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--bg-gray)', borderBottom: '1px solid var(--border)' }}>
        <select
          className="form-input"
          value={direction}
          onChange={e => setDirection(e.target.value)}
          style={{ padding: '10px 14px' }}
        >
          <option value="">Все направления</option>
          {DIRECTIONS.slice(1).map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div style={{ padding: '8px 16px' }}>
        {loading ? (
          <LogoLoader fullPage />
        ) : rivals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Конкурентов нет!</div>
            <div>На выбранном направлении нет конкурентов</div>
          </div>
        ) : (
          rivals.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--orange-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                🚌
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  Маршрут №{r.route_number ?? r.id}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.direction}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: getSpeedColor(r.speed) }}>
                  {r.speed.toFixed(0)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>км/ч</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <button className="btn btn-secondary" onClick={load} style={{ border: '1.5px solid var(--border)' }}>
          🔄 Обновить
        </button>
      </div>
    </div>
  )
}
