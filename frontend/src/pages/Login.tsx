import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatVU } from '../utils/format'

function BusLogo() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="22" fill="rgba(255,255,255,0.2)" />
      {/* Flame */}
      <path d="M22 4C22 4 16 11 16 17C16 20.3 17.8 23 20.5 24.5C19.5 22 19.5 19.5 21 18C21 21 23 22.5 23 25.5C23 22.5 25 20 25 17C26.8 19.5 26.2 22.5 25 24.5C27.8 22.8 29.5 19.8 29.5 17C29.5 10.5 22 4 22 4Z" fill="white"/>
      {/* Bus */}
      <rect x="10" y="24" width="24" height="13" rx="3" fill="white"/>
      <rect x="12" y="26" width="8" height="5" rx="1.5" fill="rgba(255,102,0,0.5)"/>
      <rect x="24" y="26" width="8" height="5" rx="1.5" fill="rgba(255,102,0,0.5)"/>
      <circle cx="15" cy="38" r="2" fill="rgba(255,102,0,0.7)"/>
      <circle cx="29" cy="38" r="2" fill="rgba(255,102,0,0.7)"/>
      <rect x="10" y="31" width="24" height="1.5" fill="rgba(0,0,0,0.1)"/>
    </svg>
  )
}

export default function Login() {
  const [driverVU, setDriverVU] = useState('')
  const [phone, setPhone] = useState('+7')
  const [errorDriver, setErrorDriver] = useState('')
  const [errorEnt, setErrorEnt] = useState('')
  const navigate = useNavigate()

  const handleDriver = () => {
    const digits = driverVU.replace(/\D/g, '')
    if (!digits) { setErrorDriver('Введите номер ВУ'); return }
    if (digits.length < 10) { setErrorDriver('Номер ВУ: 10 цифр — например, 00 00 123456'); return }
    navigate('/login/password', { state: { role: 'driver', identifier: driverVU.trim() } })
  }

  const formatPhone = (val: string) => {
    let d = val.replace(/\D/g, '')
    if (!d.startsWith('7')) d = '7' + d
    if (d.length > 11) d = d.slice(0, 11)
    let f = '+' + d[0]
    if (d.length > 1) f += ' (' + d.slice(1, 4)
    if (d.length >= 4) f += ') ' + d.slice(4, 7)
    if (d.length >= 7) f += '-' + d.slice(7, 9)
    if (d.length >= 9) f += '-' + d.slice(9, 11)
    return f
  }

  const handleEnt = () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 11) { setErrorEnt('Введите полный номер телефона'); return }
    navigate('/login/password', { state: { role: 'entrepreneur', identifier: '+' + digits } })
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#F2F2F2' }}>

      {/* Header */}
      <div style={{ background: 'var(--orange)', padding: '10px 16px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <img src="/logo.png" alt="Лого" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>Мой.Маршрут</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>ИИ-навигация и управление автопарком</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '24px 20px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Welcome */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 16, color: '#555', marginBottom: 4 }}>Добро пожаловать в систему</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--orange)', letterSpacing: '-0.5px' }}>Мой.Маршрут</div>
        </div>

        {/* Driver block */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, textAlign: 'center' }}>
            для водителя
          </div>

          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="4" width="18" height="12" rx="2" stroke="#CCCCCC" strokeWidth="1.5"/>
                <rect x="3.5" y="7" width="4" height="3" rx="0.8" stroke="#CCCCCC" strokeWidth="1.2"/>
                <line x1="9.5" y1="8" x2="16.5" y2="8" stroke="#CCCCCC" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="9.5" y1="11" x2="14.5" y2="11" stroke="#CCCCCC" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="3.5" y1="13.5" x2="16.5" y2="13.5" stroke="#CCCCCC" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </span>
            <input
              className="form-input"
              placeholder="Номер ВУ"
              value={driverVU}
              onChange={e => { setDriverVU(formatVU(e.target.value)); setErrorDriver('') }}
              onKeyDown={e => e.key === 'Enter' && handleDriver()}
              style={{ paddingLeft: 42, background: '#fff', border: `1.5px solid ${errorDriver ? 'var(--danger)' : '#E0E0E0'}`, borderRadius: 12 }}
            />
          </div>
          {errorDriver && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8, paddingLeft: 4 }}>{errorDriver}</div>
          )}
          <button className="btn btn-primary" onClick={handleDriver} style={{ borderRadius: 12, marginBottom: 8 }}>
            Войти
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#DDD', margin: '4px 0 20px' }} />

        {/* Entrepreneur block */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#222', marginBottom: 12, textAlign: 'center' }}>
            Вход для ИП
          </div>

          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.47 11.47 0 0 0 3.58.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <input
              className="form-input"
              placeholder="Номер телефона"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && handleEnt()}
              type="tel"
              style={{ paddingLeft: 42, background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12 }}
            />
          </div>
          {errorEnt && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8, paddingLeft: 4 }}>{errorEnt}</div>
          )}
          <button className="btn btn-primary" onClick={handleEnt} style={{ borderRadius: 12, marginBottom: 10 }}>
            Войти
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#DDD', margin: '20px 0 20px' }} />

        {/* For everyone block */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, textAlign: 'center' }}>
            Мой.Маршрут — для всех
          </div>
          <a
            href="https://t.me/MyRouteWeb_Bot"
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: '100%', boxSizing: 'border-box', padding: '13px', background: 'white', border: '1.5px solid #E0E0E0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#333', textDecoration: 'none' }}
          >
            <img src="/telegram-logo.png" alt="Telegram" style={{ width: 20, height: 20 }} />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>Telegram-бот</span>
              <span>🔥Мой.Маршрут - ГЛОНАСС/ЕТК</span>
            </span>
          </a>
        </div>
      </div>
      </div>

      {/* Footer */}
      <div style={{ background: 'var(--orange)', padding: '14px 20px', textAlign: 'center', flexShrink: 0, paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ color: 'white', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          © Мои.Маршрутчики, 2026
        </div>
        <a
          href="https://t.me/+sqIPcxR1DeU4M2My"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}
        >
          <img src="/telegram-logo.png" alt="Telegram" style={{ width: 18, height: 18 }} />
          <span style={{ color: 'white', fontSize: 12, textDecoration: 'underline' }}>Наш проект в Telegram</span>
        </a>
      </div>
    </div>
  )
}
