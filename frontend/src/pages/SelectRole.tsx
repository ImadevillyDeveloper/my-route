import { useNavigate } from 'react-router-dom'

export default function SelectRole() {
  const navigate = useNavigate()

  return (
    <div className="page-no-nav" style={{ background: 'var(--bg-white)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--orange)', padding: '48px 24px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🚌</div>
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
          Мой.Маршрут
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>
          Система управления пассажирским транспортом
        </p>
      </div>

      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15, marginBottom: 8 }}>
          Выберите тип входа
        </p>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/login/driver')}
          style={{ padding: '20px 24px', borderRadius: 16 }}
        >
          <span style={{ fontSize: 24 }}>🚗</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Я водитель</div>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 400, marginTop: 2 }}>Вход по ID-номеру</div>
          </div>
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => navigate('/login/entrepreneur')}
          style={{ padding: '20px 24px', borderRadius: 16, border: '2px solid var(--border)' }}
        >
          <span style={{ fontSize: 24 }}>💼</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Я предприниматель</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>Вход по номеру телефона</div>
          </div>
        </button>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '0 24px 32px' }}>
        © Мой.Маршрут, 2026
      </p>
    </div>
  )
}
