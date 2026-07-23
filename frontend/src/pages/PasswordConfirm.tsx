import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginDriver, loginEntrepreneur } from '../api/client'
import { useAuthStore } from '../store/auth'

export default function PasswordConfirm() {
  const location = useLocation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const state = location.state as { role: 'driver' | 'entrepreneur'; identifier: string } | null

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordNotSet, setPasswordNotSet] = useState(false)

  if (!state?.role || !state?.identifier) {
    navigate('/', { replace: true })
    return null
  }
  const { role, identifier } = state

  const submit = async () => {
    if (!password) { setError('Введите пароль'); return }
    setLoading(true); setError(''); setPasswordNotSet(false)
    try {
      const res = role === 'driver' ? await loginDriver(identifier, password) : await loginEntrepreneur(identifier, password)
      const { access_token, role: r, user_id, full_name } = res.data
      setAuth(access_token, r, user_id, full_name)
      navigate(role === 'driver' ? '/driver/map' : '/entrepreneur/map', { replace: true })
    } catch (e: any) {
      if (e.response?.data?.detail === 'PASSWORD_NOT_SET') setPasswordNotSet(true)
      else setError(e.response?.data?.detail || 'Неверный пароль')
    } finally {
      setLoading(false)
    }
  }

  const goToReset = () => navigate('/login/reset', { state: { role, identifier } })

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F2F2F2', overflow: 'hidden' }}>
      <div style={{ background: 'var(--orange)', padding: '10px 16px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>Мой.Маршрут</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>{role === 'driver' ? 'Вход для водителя' : 'Вход для ИП'}</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 20px 16px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 16, color: '#555', marginBottom: 4 }}>Введите пароль</div>
            <div style={{ fontSize: 15, color: '#999' }}>{identifier}</div>
          </div>

          {passwordNotSet ? (
            <div style={{ background: 'white', borderRadius: 16, padding: '20px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.5 }}>
                Для этого аккаунта ещё не задан пароль. Задайте его через Telegram-бота — это займёт минуту.
              </div>
              <button className="btn btn-primary" onClick={goToReset} style={{ borderRadius: 12 }}>
                Задать пароль через бота
              </button>
            </div>
          ) : (
            <>
              <input
                className="form-input"
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ background: '#fff', border: `1.5px solid ${error ? 'var(--danger)' : '#E0E0E0'}`, borderRadius: 12, marginBottom: 10 }}
                autoFocus
              />
              {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8, paddingLeft: 4 }}>{error}</div>}
              <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ borderRadius: 12, marginBottom: 14 }}>
                {loading ? 'Вход...' : 'Войти'}
              </button>
              <div style={{ textAlign: 'center' }}>
                <span onClick={goToReset} style={{ color: 'var(--orange)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                  Забыли пароль?
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
