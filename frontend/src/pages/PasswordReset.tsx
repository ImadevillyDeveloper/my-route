import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { confirmPasswordReset } from '../api/client'
import { useAuthStore } from '../store/auth'

export default function PasswordReset() {
  const location = useLocation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const state = location.state as { role: 'driver' | 'entrepreneur'; identifier: string } | null

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!state?.role || !state?.identifier) {
    navigate('/', { replace: true })
    return null
  }
  const { role, identifier } = state

  const submit = async () => {
    if (!code.trim()) { setError('Введите код из Telegram'); return }
    if (password.trim().length < 4) { setError('Пароль — минимум 4 символа'); return }
    if (password !== password2) { setError('Пароли не совпадают'); return }
    setLoading(true); setError('')
    try {
      const res = await confirmPasswordReset(role, identifier, code.trim(), password.trim())
      const { access_token, role: r, user_id, full_name } = res.data
      setAuth(access_token, r, user_id, full_name)
      navigate(role === 'driver' ? '/driver/map' : '/entrepreneur/map', { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Неверный или истёкший код')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#F2F2F2' }}>
      <div style={{ background: 'var(--orange)', padding: '10px 16px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={() => navigate('/login/password', { state: { role, identifier } })}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>Мой.Маршрут</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>Восстановление пароля</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px 16px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '18px', marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Как получить код</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
              1. Откройте бота @MyRouteSupport_bot в Telegram<br />
              2. Нажмите «Поделиться номером» — так мы убедимся, что это вы<br />
              3. Бот пришлёт код — введите его ниже вместе с новым паролем
            </div>
            <a href="https://t.me/MyRouteSupport_bot" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: '#F7F7F7', border: '1.5px solid #E0E0E0', borderRadius: 12, textDecoration: 'none', color: '#333', fontWeight: 600, fontSize: 14 }}>
              <img src="/telegram-logo.png" alt="Telegram" style={{ width: 18, height: 18 }} />
              Открыть @MyRouteSupport_bot
            </a>
          </div>

          <input className="form-input" placeholder="Код из Telegram" value={code} inputMode="numeric"
            onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
            style={{ background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12, marginBottom: 10 }} />
          <input className="form-input" type="password" placeholder="Новый пароль" value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            style={{ background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12, marginBottom: 10 }} />
          <input className="form-input" type="password" placeholder="Повторите новый пароль" value={password2}
            onChange={e => { setPassword2(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12, marginBottom: 10 }} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8, paddingLeft: 4 }}>{error}</div>}
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ borderRadius: 12 }}>
            {loading ? 'Сохранение...' : 'Сохранить и войти'}
          </button>
        </div>
      </div>
    </div>
  )
}
