import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginDriver, loginEntrepreneur, loginGosuslugi } from '../api/client'
import { useAuthStore } from '../store/auth'
import StatusBar from '../components/common/StatusBar'

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

function GosuslugiLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="10.5" height="10.5" fill="#0066CC" rx="1.5"/>
      <rect x="11.5" y="0" width="10.5" height="10.5" fill="#CC0000" rx="1.5"/>
      <rect x="0" y="11.5" width="10.5" height="10.5" fill="#009933" rx="1.5"/>
      <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#FF9900" rx="1.5"/>
    </svg>
  )
}

export default function Login() {
  const [driverVU, setDriverVU] = useState('')
  const [phone, setPhone] = useState('+7')
  const [loadingDriver, setLoadingDriver] = useState(false)
  const [loadingEnt, setLoadingEnt] = useState(false)
  const [loadingGos, setLoadingGos] = useState(false)
  const [errorDriver, setErrorDriver] = useState('')
  const [errorEnt, setErrorEnt] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const handleDriver = async () => {
    if (!driverVU.trim()) { setErrorDriver('Введите номер ВУ'); return }
    setLoadingDriver(true); setErrorDriver('')
    try {
      const res = await loginDriver(driverVU.trim())
      const { access_token, role, user_id, full_name } = res.data
      setAuth(access_token, role, user_id, full_name)
      navigate('/driver/map', { replace: true })
    } catch { setErrorDriver('Неверный номер ВУ') }
    finally { setLoadingDriver(false) }
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

  const handleEnt = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 11) { setErrorEnt('Введите полный номер телефона'); return }
    setLoadingEnt(true); setErrorEnt('')
    try {
      const res = await loginEntrepreneur('+' + digits)
      const { access_token, role, user_id, full_name } = res.data
      setAuth(access_token, role, user_id, full_name)
      navigate('/entrepreneur/dashboard', { replace: true })
    } catch { setErrorEnt('Ошибка входа') }
    finally { setLoadingEnt(false) }
  }

  const handleGosuslugi = async () => {
    setLoadingGos(true); setErrorEnt('')
    try {
      const res = await loginGosuslugi()
      const { access_token, role, user_id, full_name } = res.data
      setAuth(access_token, role, user_id, full_name)
    } catch {
      // Фейковый вход: устанавливаем демо-данные предпринимателя
      setAuth('gosuslugi_demo', 'entrepreneur', 1, 'Черепанов В.Г.')
    } finally {
      setLoadingGos(false)
      navigate('/entrepreneur/map', { replace: true })
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F2F2F2' }}>
      <StatusBar />

      {/* Header */}
      <div style={{ background: 'var(--orange)', padding: '10px 16px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#bbb' }}>🪪</span>
            <input
              className="form-input"
              placeholder="Номер ВУ"
              value={driverVU}
              onChange={e => setDriverVU(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDriver()}
              style={{ paddingLeft: 42, background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12 }}
            />
          </div>
          {errorDriver && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8, paddingLeft: 4 }}>{errorDriver}</div>
          )}
          <button className="btn btn-primary" onClick={handleDriver} disabled={loadingDriver} style={{ borderRadius: 12, marginBottom: 8 }}>
            {loadingDriver ? 'Вход...' : 'Войти'}
          </button>
          <button
            onClick={() => { setDriverVU('00 00 123456'); setTimeout(handleDriver, 100) }}
            style={{ width: '100%', padding: '13px', background: 'white', border: '1.5px solid #E0E0E0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#333' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 3C9.8 3 7.8 3.9 6.4 5.4"/>
              <path d="M17.6 5.4C16.2 3.9 14.2 3 12 3"/>
              <path d="M4.1 9C3.4 10.2 3 11.6 3 13"/>
              <path d="M21 13c0-1.4-.4-2.8-1.1-4"/>
              <path d="M12 8c-2.8 0-5 2.2-5 5v1"/>
              <path d="M17 13a5 5 0 0 0-5-5"/>
              <path d="M12 13v5"/>
              <path d="M9 17.5C9 19 10.3 20 12 20s3-1 3-2.5"/>
            </svg>
            Войти по биометрии
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
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#bbb' }}>📞</span>
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
          <button className="btn btn-primary" onClick={handleEnt} disabled={loadingEnt} style={{ borderRadius: 12, marginBottom: 10 }}>
            {loadingEnt ? 'Вход...' : 'Войти'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 10px' }}>
            <div style={{ flex: 1, height: 1, background: '#E8E8E8' }} />
            <span style={{ fontSize: 12, color: '#BBB', fontWeight: 500 }}>или</span>
            <div style={{ flex: 1, height: 1, background: '#E8E8E8' }} />
          </div>

          <button
            onClick={handleGosuslugi}
            disabled={loadingGos}
            style={{
              width: '100%', padding: '12px 16px',
              background: 'white', border: '1.5px solid #D0D8E4',
              borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10,
              cursor: loadingGos ? 'default' : 'pointer',
              opacity: loadingGos ? 0.65 : 1,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!loadingGos) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1466AC'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(20,102,172,0.15)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#D0D8E4'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
          >
            <img src="/gosuslugi-logo.svg" alt="" style={{ height: 26, width: 'auto', flexShrink: 0 }} />
            <span style={{ color: '#1A1A1A', fontWeight: 600, fontSize: 14 }}>
              {loadingGos ? 'Вход...' : 'Войти через Госуслуги'}
            </span>
          </button>
        </div>
      </div>
      </div>

      {/* Footer */}
      <div style={{ background: 'var(--orange)', padding: '14px 20px', textAlign: 'center' }}>
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
