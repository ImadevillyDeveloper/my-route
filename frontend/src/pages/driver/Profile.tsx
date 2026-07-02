import { useEffect, useRef, useState } from 'react'
import { getMe, uploadDriverPhoto, resolveAssetUrl } from '../../api/client'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../../components/common/StatusBar'
import LogoLoader from '../../components/common/LogoLoader'
import type { User } from '../../types'

const Row = ({ icon, label, value, valueColor }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string
}) => (
  <div className="row-item">
    <div className="row-icon">{icon}</div>
    <span className="row-label">{label}</span>
    <span className="row-value" style={valueColor ? { color: valueColor } : {}}>{value}</span>
  </div>
)

export default function DriverProfile() {
  const [user, setUser] = useState<User | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    getMe().then(r => setUser(r.data)).catch(() => {})
  }, [])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      const res = await uploadDriverPhoto(user.id, file)
      setUser(u => u ? { ...u, avatar_url: res.data.avatar_url } : u)
    } catch {}
    e.target.value = ''
  }

  if (!user) return <div className="page"><StatusBar /><LogoLoader fullPage /></div>

  const avatarSrc = user.avatar_url ? resolveAssetUrl(user.avatar_url) : null
  const plate     = (user as any).vehicle_plate || '—'
  const route     = (user as any).route_number  || '—'

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мой ЛК</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Аватар + имя */}
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => photoInputRef.current?.click()}
            style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--border)', cursor: 'pointer' }}>
            {avatarSrc
              ? <img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{user.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              {user.driver_id} · №{route}
            </div>
          </div>
        </div>

        {/* Данные из БД */}
        <div className="card">
          <Row
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
            label="Номер ВУ" value={user.driver_id || '—'} />
          <Row
            icon={<img src="/bus.png" width="20" height="20" />}
            label="Гос. номер ТС" value={plate} valueColor={plate !== '—' ? 'var(--orange)' : undefined} />
          <Row
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 17l2-7h14l2 7"/><path d="M5 17h14"/></svg>}
            label="Маршрут" value={route !== '—' ? `№${route}` : '—'} />
          <Row
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
            label="Телефон" value={user.phone || '—'} />
        </div>

        {/* Ссылка на отчёты */}
        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/driver/shifts')}>
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
              </svg>
            </div>
            <span className="row-label">Перейти к Отчётам</span>
            <span className="row-arrow">›</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 16px' }}>
          Чтобы изменить данные, обратитесь к предпринимателю
        </p>
      </div>
    </div>
  )
}
