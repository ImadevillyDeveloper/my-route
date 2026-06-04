import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import StatusBar from '../../components/common/StatusBar'

// Все маршруты Омска, подключённые к системе ГЛОНАСС
const OMSK_ROUTES: { type: string; routes: string[] }[] = [
  {
    type: 'Автобусы',
    routes: [
      '1','3','5','6Н','8Н','11','12','13','14','16','17','20','21','22','23','24','25','26',
      '28','29','30','31','32','33','34','36к','37','39','45','46','47Н','49','50','51','52',
      '55','58','59','60','61','62','63','66','70','71','72','73','77','78','79','80','83',
      '87','88','89','90','94','95','96','98','100','103','106','109','110','112','116','117',
      '119','122','125','131','132','136','138','139','140','141','144','145','155','156','157',
      '158','159','160','161','162','165','168','169','171','172','173','174','177','178','185',
      '190','191','193','196','197','198','212','214','219','324','327','336','352','355','507П',
    ],
  },
  {
    type: 'Троллейбусы',
    routes: ['Тр.2','Тр.3','Тр.4','Тр.7','Тр.12','Тр.15','Тр.16','Тр.67'],
  },
  {
    type: 'Трамваи',
    routes: ['Тм.1','Тм.2','Тм.4','Тм.7','Тм.8','Тм.9'],
  },
]

const ALL_ROUTES = OMSK_ROUTES.flatMap(g => g.routes)
const STORAGE_KEY = 'driver_rival_routes'

export default function DriverSettings() {
  const [voiceOn, setVoiceOn] = useState(true)
  const [rivals, setRivals] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [inputValue, setInputValue] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const navigate = useNavigate()
  const logout = useAuthStore(s => s.logout)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rivals))
  }, [rivals])

  const toggle = (r: string) =>
    setRivals(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  const addRoute = (r: string) => {
    if (!rivals.includes(r)) setRivals(prev => [...prev, r])
    setInputValue('')
    setDropOpen(false)
    inputRef.current?.focus()
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const suggestions = inputValue.trim()
    ? ALL_ROUTES.filter(r =>
        r.toLowerCase().includes(inputValue.toLowerCase()) && !rivals.includes(r)
      ).slice(0, 8)
    : []

  const handleLogout = () => { logout(); navigate('/', { replace: true }) }

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Настройки</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Rival routes */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Конкурентные маршруты</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
            Выбранные маршруты отображаются на карте как конкуренты
          </div>

          {/* Autocomplete input */}
          <div ref={dropRef} style={{ position: 'relative', marginBottom: rivals.length ? 10 : 0 }}>
            <input
              ref={inputRef}
              className="form-input"
              placeholder="Введите номер маршрута..."
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value)
                if (inputRef.current) {
                  const r = inputRef.current.getBoundingClientRect()
                  setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
                }
                setDropOpen(true)
              }}
              onFocus={() => {
                if (inputValue.trim() && inputRef.current) {
                  const r = inputRef.current.getBoundingClientRect()
                  setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
                  setDropOpen(true)
                }
              }}
              style={{ fontSize: 14, paddingRight: 36 }}
            />
            <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>

          </div>

          {rivals.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rivals.map(r => (
                <div key={r} style={{ background: '#FFF3EE', borderRadius: 20, padding: '5px 10px 5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>№{r}</span>
                  <button onClick={() => toggle(r)}
                    style={{ background: 'none', border: 'none', color: '#AAAAAA', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Voice toggle */}
        <div className="card">
          <div className="row-item">
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </div>
            <span className="row-label">Голосовой помощник</span>
            <div className={`toggle ${voiceOn ? 'toggle-on' : 'toggle-off'}`} onClick={() => setVoiceOn(v => !v)}>
              <div className="toggle-thumb" />
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }}>
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <span className="row-label">Тех.поддержка</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        {/* Logout */}
        <button className="btn btn-outline-gray" onClick={() => setShowLogoutModal(true)}
          style={{ marginTop: 8, gap: 10, padding: '14px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Выйти из аккаунта
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 12 }}>
        Версия сборки: 1.0.4.5&nbsp;&nbsp;
        <a href="#" style={{ color: 'var(--orange)', textDecoration: 'underline' }}>О приложении</a>
      </div>

      {/* Autocomplete dropdown (fixed, чтобы не обрезался overflow:hidden карточки) */}
      {dropOpen && suggestions.length > 0 && (
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)', zIndex: 2000, overflow: 'hidden' }}>
          {suggestions.map((r, i) => (
            <div key={r} onMouseDown={() => addRoute(r)}
              style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F5' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFF3EE')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--orange)' }}>{r}</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Маршрут №{r}</span>
              <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
          ))}
        </div>
      )}
      {dropOpen && inputValue.trim() && suggestions.length === 0 && (
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid var(--border)', zIndex: 2000, padding: '12px 16px', fontSize: 14, color: 'var(--text-muted)' }}>
          {rivals.includes(inputValue.trim()) ? 'Уже добавлен' : 'Маршрут не найден'}
        </div>
      )}

      {/* Logout modal */}
      {showLogoutModal && (
        <div onClick={() => setShowLogoutModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 24, padding: '32px 28px 28px', width: '100%', maxWidth: 340, position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setShowLogoutModal(false)}
              style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>

            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
              <span style={{ position: 'absolute', top: -4, right: -4, color: 'var(--orange)', fontSize: 14, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', top: 10, left: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: 0, right: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: -4, left: -4, color: 'var(--orange)', fontSize: 10, fontWeight: 700 }}>+</span>
            </div>

            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Выйти из аккаунта?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
              Чтобы войти заново, понадобится<br />номер ВУ или биометрия.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowLogoutModal(false)}
                style={{ flex: 1, padding: '14px', borderRadius: 50, border: '2px solid var(--orange)', background: 'white', color: 'var(--orange)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Отмена</button>
              <button onClick={handleLogout}
                style={{ flex: 1, padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Выйти</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
