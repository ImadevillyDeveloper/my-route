import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginDriver } from '../../api/client'
import { useAuthStore } from '../../store/auth'

export default function DriverLogin() {
  const [driverId, setDriverId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const handleLogin = async () => {
    if (!driverId.trim()) { setError('Введите номер водительского удостоверения'); return }
    setLoading(true)
    setError('')
    try {
      const res = await loginDriver(driverId.trim())
      const { access_token, role, user_id, full_name } = res.data
      setAuth(access_token, role, user_id, full_name)
      navigate('/driver/map', { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Номер ВУ не найден. Обратитесь к предпринимателю.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-no-nav">
      <div style={{ background: 'var(--orange)', padding: '40px 24px 36px' }}>
        <button
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 14px', color: 'white', fontSize: 14, cursor: 'pointer', marginBottom: 20 }}
          onClick={() => navigate('/')}
        >
          ← Назад
        </button>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🚗</div>
        <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800 }}>Вход для водителя</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
          Введите ваш личный ID-номер
        </p>
      </div>

      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="form-group">
          <label className="form-label">Номер водительского удостоверения</label>
          <input
            className="form-input"
            placeholder="Например: 00 00 123456"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{ fontSize: 18, letterSpacing: 1, textAlign: 'center', fontWeight: 700 }}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Введите номер ВУ, который был зарегистрирован предпринимателем
          </p>
        </div>

        {error && (
          <div style={{ background: '#FEE', color: 'var(--danger)', padding: '12px 16px', borderRadius: 10, fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={loading}
          style={{ padding: '16px', fontSize: 17 }}
        >
          {loading ? '⏳ Вход...' : 'Войти'}
        </button>

      </div>
    </div>
  )
}
