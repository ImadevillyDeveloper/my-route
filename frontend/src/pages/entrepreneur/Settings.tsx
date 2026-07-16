import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { getRoutesWithOverrides } from '../../api/routes'
import { sendSupport } from '../../api/client'
import LogoLoader from '../../components/common/LogoLoader'

const FAV_ROUTE_KEY = 'ent_favorite_route'

const TOPICS = [
  { value: 'bug',      label: '🐛 Техническая проблема' },
  { value: 'question', label: '❓ Вопрос' },
  { value: 'proposal', label: '💡 Предложение' },
  { value: 'other',    label: '📝 Другое' },
]

const GosuslugiLogo = () => (
  <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
    <path d="M24 3L42 13.5V34.5L24 45L6 34.5V13.5L24 3Z" fill="#0066CC"/>
    <text x="24" y="32" textAnchor="middle" fill="white" fontSize="20" fontWeight="900" fontFamily="Arial">Г</text>
  </svg>
)

const LogoutIcon = ({ size = 22, color = 'var(--orange)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

interface Route { number: string; name: string; start_point: string; end_point: string }

export default function EntSettings() {
  const [routes, setRoutes]               = useState<Route[]>([])
  const [routesLoaded, setRoutesLoaded]   = useState(false)
  const [favorite, setFavorite]           = useState<string>(() => localStorage.getItem(FAV_ROUTE_KEY) ?? '')
  const [dropOpen, setDropOpen]           = useState(false)
  const [dropPos, setDropPos]             = useState({ top: 0, left: 0, width: 0 })
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSupport, setShowSupport]     = useState(false)
  const [topic, setTopic]                 = useState('bug')
  const [message, setMessage]             = useState('')
  const [contact, setContact]             = useState('')
  const [sending, setSending]             = useState(false)
  const [sent, setSent]                   = useState(false)
  const [sendError, setSendError]         = useState('')
  const rowRef   = useRef<HTMLDivElement>(null)
  const logout   = useAuthStore((s) => s.logout)
  const phone    = useAuthStore((s) => s.fullName)
  const navigate = useNavigate()

  useEffect(() => {
    getRoutesWithOverrides().then(setRoutes).catch(() => {}).finally(() => setRoutesLoaded(true))
  }, [])

  useEffect(() => {
    if (!dropOpen) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-fav-drop]')) setDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropOpen])

  const openDrop = () => {
    if (rowRef.current) {
      const r = rowRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setDropOpen(o => !o)
  }

  const selectRoute = (num: string) => {
    setFavorite(num)
    localStorage.setItem(FAV_ROUTE_KEY, num)
    setDropOpen(false)
  }

  const clearFavorite = () => {
    setFavorite('')
    localStorage.removeItem(FAV_ROUTE_KEY)
  }

  const handleLogout = () => { logout(); navigate('/', { replace: true }) }

  const openSupport = () => {
    setTopic('bug'); setMessage(''); setContact(''); setSent(false); setSendError('')
    setShowSupport(true)
  }

  const handleSend = async () => {
    if (!message.trim()) { setSendError('Напишите сообщение'); return }
    setSending(true); setSendError('')
    try {
      await sendSupport({ topic, message: message.trim(), contact: contact.trim() || undefined })
      setSent(true)
    } catch {
      setSendError('Не удалось отправить. Попробуйте позже.')
    } finally {
      setSending(false)
    }
  }

  const favRoute = routes.find(r => r.number === favorite)

  if (!routesLoaded) return <div className="page"><LogoLoader fullPage /></div>

  return (
    <div className="page" style={{ position: 'relative' }}>
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Настройки</span>
      </div>

      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Избранный маршрут */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Избранный маршрут</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
            ТС этого маршрута отображаются на карте при открытии приложения
          </div>

          {favRoute && (
            <div style={{ background: '#FFF3EE', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src="/route-fav.png" width="22" height="22" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--orange)' }}>№ {favRoute.number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {favRoute.start_point} → {favRoute.end_point}
                </div>
              </div>
              <button onClick={clearFavorite} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAAAAA', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>✕</button>
            </div>
          )}

          <div data-fav-drop ref={rowRef} onClick={openDrop}
            className="form-input"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: favorite ? 'var(--orange)' : 'var(--text-muted)', fontWeight: favorite ? 600 : 400, fontSize: 14 }}>
            <span>{favorite ? `Маршрут № ${favorite}` : 'Выберите маршрут'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <polyline points={dropOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
            </svg>
          </div>

          {dropOpen && (
            <div data-fav-drop style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 1000, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid var(--border)', maxHeight: 260, overflowY: 'auto' }}>
              {routes.length === 0
                ? <div style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-muted)' }}>Нет маршрутов</div>
                : routes.map(rt => {
                  const isSelected = rt.number === favorite
                  return (
                    <div key={rt.number} onMouseDown={() => selectRoute(rt.number)}
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isSelected ? '#FFF3EE' : 'white', borderBottom: '1px solid #F5F5F5' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isSelected ? 'var(--orange)' : '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: isSelected ? 'white' : 'var(--text-muted)' }}>{rt.number}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? 'var(--orange)' : 'var(--text-primary)' }}>№ {rt.number}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {rt.start_point} → {rt.end_point}
                        </div>
                      </div>
                      {isSelected && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  )
                })
              }
            </div>
          )}
        </div>

        {/* Учётная запись Госуслуги */}
        <div className="card" style={{ padding: 0 }}>
          <div className="row-item" style={{ cursor: 'pointer', padding: '16px' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Учётная запись</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <GosuslugiLogo />
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                <span style={{ color: '#0066CC' }}>гос</span><span style={{ color: '#CC0000' }}>услуги</span>
              </span>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--orange)', fontSize: 22 }}>›</span>
          </div>
        </div>

        {/* Тех.поддержка */}
        <div className="card" style={{ padding: 0 }}>
          <div className="row-item" style={{ cursor: 'pointer', padding: '16px' }} onClick={openSupport}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Тех.поддержка</span>
            <span style={{ marginLeft: 'auto', color: 'var(--orange)', fontSize: 22 }}>›</span>
          </div>
        </div>

        {/* Выйти */}
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setShowLogoutModal(true)}
            style={{ width: '100%', padding: '16px', borderRadius: 50, border: '2px solid #E0E0E0', background: 'white', color: 'var(--text-primary)', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <LogoutIcon />
            Выйти из аккаунта
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: 80, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 28px', fontSize: 13, color: 'var(--text-muted)' }}>
        <span>Версия сборки: 1.0.4.5</span>
        <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>О приложении</span>
      </div>

      {/* ── Модал: Тех.поддержка ── */}
      {showSupport && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <span style={{ fontWeight: 800, fontSize: 17 }}>Тех.поддержка</span>
              </div>
              <button onClick={() => setShowSupport(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
            </div>

            {sent ? (
              /* Успешная отправка */
              <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E8F8EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Обращение отправлено!</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                  Мы свяжемся с вами в ближайшее время.
                </div>
                <button onClick={() => setShowSupport(false)}
                  style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Закрыть
                </button>
              </div>
            ) : (
              /* Форма */
              <div style={{ padding: '20px' }}>

                {/* Тема */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Тема обращения</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {TOPICS.map(t => (
                      <button key={t.value} onClick={() => setTopic(t.value)}
                        style={{ padding: '7px 12px', borderRadius: 20, border: `1.5px solid ${topic === t.value ? 'var(--orange)' : 'var(--border)'}`, background: topic === t.value ? '#FFF3EE' : 'white', color: topic === t.value ? 'var(--orange)' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Контакт */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Как с вами связаться</div>
                  <input
                    className="form-input"
                    placeholder="Телефон или e-mail"
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    style={{ fontSize: 14 }}
                  />
                </div>

                {/* Сообщение */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Опишите проблему или вопрос</div>
                  <textarea
                    className="form-input"
                    placeholder="Подробно опишите, что произошло..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    style={{ resize: 'none', fontSize: 14, lineHeight: 1.5 }}
                  />
                </div>

                {sendError && (
                  <div style={{ fontSize: 13, color: '#FF3B30', marginBottom: 12, padding: '8px 12px', background: '#FFF0EF', borderRadius: 10 }}>
                    {sendError}
                  </div>
                )}

                <button onClick={handleSend} disabled={sending}
                  style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: sending ? '#FFAA77' : 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: sending ? 'default' : 'pointer' }}>
                  {sending ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Модал: Выйти ── */}
      {showLogoutModal && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '32px 28px 28px', width: '100%', maxWidth: 340, position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setShowLogoutModal(false)} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>

            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogoutIcon size={40} />
              </div>
              <span style={{ position: 'absolute', top: -4, right: -4, color: 'var(--orange)', fontSize: 14, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', top: 10, left: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: 0, right: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: -4, left: -4, color: 'var(--orange)', fontSize: 10, fontWeight: 700 }}>+</span>
            </div>

            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Выйти из аккаунта?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
              Чтобы войти заново, понадобится<br />код или Госуслуги.
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
