import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useUnreadChatCount } from '../chat/useUnreadChatCount'
import BusIcon from '../common/BusIcon'
import { initPushNotifications } from '../../push'

const CHAT_BADGE = (unread: number) => unread > 0 && (
  <span style={{ position: 'absolute', top: -3, right: -3, background: '#FF3B30', color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 8, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid white' }}>
    {unread > 9 ? '9+' : unread}
  </span>
)

const REPORT_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
    <line x1="9" y1="16" x2="13" y2="16"/>
  </svg>
)

const navItems = [
  {
    to: '/driver/map', label: 'Карта',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    )
  },
  {
    to: '/driver/chat', label: 'Чат',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    )
  },
  {
    to: '/driver/shifts', label: 'Архив',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8"/>
        <rect x="1" y="3" width="22" height="5"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    )
  },
  {
    to: '/driver/settings', label: 'Настройки',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    )
  },
]

export default function DriverLayout() {
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isReportActive = location.pathname === '/driver/report'
  const unreadChat = useUnreadChatCount()

  useEffect(() => { initPushNotifications() }, [])

  return (
    <div className="layout-root">
      <aside className="sidebar-nav">
        <div className="sidebar-logo">
          <BusIcon size={36} />
          <div>
            <div className="sidebar-logo-name">Мой.Маршрут</div>
            <div className="sidebar-logo-role">Водитель</div>
          </div>
        </div>
        <div className="sidebar-items">
          {navItems.slice(0, 1).map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
              {({ isActive }) => (
                <>
                  <div className="sidebar-item-icon">{icon(isActive)}</div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button className={`sidebar-item${isReportActive ? ' active' : ''}`} onClick={() => setShowModal(true)}>
            <div className="sidebar-item-icon">{REPORT_ICON(isReportActive)}</div>
            <span>Отчёт</span>
          </button>
          {navItems.slice(1).map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
              {({ isActive }) => (
                <>
                  <div className="sidebar-item-icon" style={{ position: 'relative' }}>
                    {icon(isActive)}
                    {to === '/driver/chat' && CHAT_BADGE(unreadChat)}
                  </div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </aside>

      <div className="layout-page">
        <Outlet />

        <nav className="bottom-nav">
        {navItems.slice(0, 1).map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <div className="nav-item-icon">{icon(isActive)}</div>
                <span className="nav-item-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Отчёт — открывает модалку */}
        <button
          className={`nav-item${isReportActive ? ' active' : ''}`}
          onClick={() => setShowModal(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <div className="nav-item-icon">{REPORT_ICON(isReportActive)}</div>
          <span className="nav-item-label">Отчёт</span>
        </button>

        {navItems.slice(1).map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <div className="nav-item-icon" style={{ position: 'relative' }}>
                  {icon(isActive)}
                  {to === '/driver/chat' && CHAT_BADGE(unreadChat)}
                </div>
                <span className="nav-item-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      </div>

      {/* Модалка "Сформировать отчёт?" */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 24, padding: '32px 28px 28px', width: '100%', maxWidth: 320, position: 'relative', textAlign: 'center' }}
          >
            {/* Крестик */}
            <button
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}
            >✕</button>

            {/* Иконка с декорациями */}
            <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 20px' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="13" y2="16"/>
                  <circle cx="18" cy="18" r="5" fill="var(--orange)" stroke="none"/>
                  <polyline points="15.5 18 17.5 20 21 15.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{ position: 'absolute', top: -4, right: -4, color: 'var(--orange)', fontSize: 14, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', top: 8, left: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: 0, right: -10, color: '#FFBB99', fontSize: 11, fontWeight: 700 }}>+</span>
              <span style={{ position: 'absolute', bottom: -4, left: -2, color: 'var(--orange)', fontSize: 10, fontWeight: 700 }}>+</span>
            </div>

            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Сформировать отчёт?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.6 }}>
              Отчёт формируется только один раз<br />по завершению смены.
            </div>

            <button
              onClick={() => { setShowModal(false); navigate('/driver/report') }}
              style={{ width: '100%', padding: '14px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
            >К отчёту</button>
          </div>
        </div>
      )}
    </div>
  )
}

