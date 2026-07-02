import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { getMe, uploadMyPhoto, resolveAssetUrl } from '../../api/client'
import StatusBar from '../../components/common/StatusBar'

const TILES = [
  { icon: <img src="/bus.png" width="28" height="28" />, title: 'Мои ТС', sub: 'Страховки и техосмотры', to: '/entrepreneur/vehicles' },
  { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>, title: 'Мои Отчёты', sub: 'Просмотр и начисления', to: '/entrepreneur/reports' },
  { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, title: 'Мои Водители', sub: 'Персональные данные сотрудников', to: '/entrepreneur/drivers' },
  { icon: <img src="/route-icon.png" width="28" height="28" />, title: 'Мои Маршруты', sub: 'Настройка и управление', to: '/entrepreneur/routes' },
]

export default function EntProfile() {
  const navigate = useNavigate()
  const storedName = useAuthStore(s => s.fullName)
  const { token, role, userId } = useAuthStore(s => ({ token: s.token, role: s.role, userId: s.userId }))

  const [showPartner, setShowPartner] = useState(false)
  const fireRef = useRef<HTMLButtonElement>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMe().then(r => {
      if (r.data.avatar_url) setAvatar(resolveAssetUrl(r.data.avatar_url))
    }).catch(() => {})
  }, [])

  const handleAvatarClick = () => fileInputRef.current?.click()

  const togglePartner = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowPartner(v => !v)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatar(URL.createObjectURL(file))
    try {
      const res = await uploadMyPhoto(file)
      if (res.data.avatar_url) setAvatar(resolveAssetUrl(res.data.avatar_url))
    } catch {}
    e.target.value = ''
  }

  const displayName = storedName ?? 'Черепанов В.Г.'

  const shortName = (() => {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 3) return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`
    if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`
    return displayName
  })()

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мой ЛК</span>
      </div>

      <div style={{ padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <div onClick={handleAvatarClick} style={{ width: 80, height: 80, borderRadius: '50%', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }}>
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src="/bus.png" width="40" height="40" style={{ opacity: 0.35 }} />
            }
          </div>
          <div onClick={handleAvatarClick} style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--orange)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        {/* Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 6 }}>
            ИП {shortName}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button ref={fireRef} onClick={togglePartner}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, display: 'flex', alignItems: 'center' }}>
                <img src="/fire.png" alt="fire" style={{ width: 24, height: 24 }} />
              </button>
              {showPartner && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowPartner(false)} />
                  <div style={{ position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 100, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.18))' }}>
                    <img src="/partner-badge.png" alt="Партнёр проекта" style={{ width: 220, borderRadius: 12, display: 'block' }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2×2 grid */}
      <div style={{ padding: '8px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {TILES.map(({ icon, title, sub, to }) => (
          <div key={to} onClick={() => navigate(to)} className="card"
            style={{ padding: '18px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 52, height: 52, background: 'var(--orange-bg)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{sub}</div>
            <div style={{ color: 'var(--orange)', fontSize: 20, marginTop: 2 }}>›</div>
          </div>
        ))}
      </div>
    </div>
  )
}
