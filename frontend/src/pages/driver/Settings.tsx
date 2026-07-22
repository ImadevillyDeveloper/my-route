import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { sendSupport } from '../../api/client'

const TOPICS = [
  { value: 'bug',      label: '🐛 Техническая проблема' },
  { value: 'question', label: '❓ Вопрос' },
  { value: 'proposal', label: '💡 Предложение' },
  { value: 'other',    label: '📝 Другое' },
]

export default function DriverSettings() {
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSupport, setShowSupport]   = useState(false)
  const [topic, setTopic]               = useState('bug')
  const [message, setMessage]           = useState('')
  const [contact, setContact]           = useState('')
  const [sending, setSending]           = useState(false)
  const [sent, setSent]                 = useState(false)
  const [sendError, setSendError]       = useState('')
  const navigate = useNavigate()
  const logout = useAuthStore(s => s.logout)

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
    } catch { setSendError('Не удалось отправить. Попробуйте позже.') }
    finally { setSending(false) }
  }

  const handleLogout = () => { logout(); navigate('/', { replace: true }) }

  return (
    <div className="page">
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Настройки</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Мой ЛК */}
        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/driver/profile')}>
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span className="row-label">Мой ЛК</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        {/* Карта и конкуренты */}
        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/driver/settings/map')}>
            <div className="row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            </div>
            <span className="row-label">Карта и конкуренты</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        {/* Support */}
        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={openSupport}>
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

      {/* Support modal */}
      {showSupport && (
        <div className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
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
              <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E8F8EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Обращение отправлено!</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>Мы свяжемся с вами в ближайшее время.</div>
                <button onClick={() => setShowSupport(false)} style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Закрыть</button>
              </div>
            ) : (
              <div style={{ padding: '20px' }}>
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
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Как с вами связаться</div>
                  <input className="form-input" placeholder="Телефон или e-mail" value={contact} onChange={e => setContact(e.target.value)} style={{ fontSize: 14 }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Опишите проблему или вопрос</div>
                  <textarea className="form-input" placeholder="Подробно опишите, что произошло..." value={message} onChange={e => setMessage(e.target.value)} rows={4} style={{ resize: 'none', fontSize: 14, lineHeight: 1.5 }} />
                </div>
                {sendError && <div style={{ fontSize: 13, color: '#FF3B30', marginBottom: 12, padding: '8px 12px', background: '#FFF0EF', borderRadius: 10 }}>{sendError}</div>}
                <button onClick={handleSend} disabled={sending} style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: sending ? '#FFAA77' : 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: sending ? 'default' : 'pointer' }}>
                  {sending ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout modal */}
      {showLogoutModal && (
        <div onClick={() => setShowLogoutModal(false)}
          className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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
              Чтобы войти заново, понадобится<br />номер ВУ.
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
