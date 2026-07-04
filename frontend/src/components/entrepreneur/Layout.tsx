import { Outlet, NavLink } from 'react-router-dom'
import { useUnreadChatCount } from '../chat/useUnreadChatCount'

const CHAT_BADGE = (unread: number) => unread > 0 && (
  <span style={{ position: 'absolute', top: -3, right: -3, background: '#FF3B30', color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 8, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid white' }}>
    {unread > 9 ? '9+' : unread}
  </span>
)

const navItems = [
  {
    to: '/entrepreneur/map', label: 'Маршрут',
    icon: (a: boolean) => (
      <img src="/bus.png" width="22" height="22" style={{ filter: a ? 'none' : 'grayscale(1) brightness(1.3)' }} />
    )
  },
  {
    to: '/entrepreneur/profile', label: 'Мой ЛК',
    icon: (a: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
  {
    to: '/entrepreneur/chat', label: 'Чат',
    icon: (a: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    )
  },
  {
    to: '/entrepreneur/reports', label: 'Отчёты',
    icon: (a: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    )
  },
  {
    to: '/entrepreneur/settings', label: 'Настройки',
    icon: (a: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? 'var(--orange)' : '#AAA'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    )
  },
]

export default function EntrepreneurLayout() {
  const unreadChat = useUnreadChatCount()

  return (
    <div className="layout-root">
      <aside className="sidebar-nav">
        <div className="sidebar-logo">
          <img src="/bus.png" width="36" height="36" />
          <div>
            <div className="sidebar-logo-name">Мой.Маршрут</div>
            <div className="sidebar-logo-role">Предприниматель</div>
          </div>
        </div>
        <div className="sidebar-items">
          {navItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
              {({ isActive }) => (
                <>
                  <div className="sidebar-item-icon" style={{ position: 'relative' }}>
                    {icon(isActive)}
                    {to === '/entrepreneur/chat' && CHAT_BADGE(unreadChat)}
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
          {navItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              {({ isActive }) => (
                <>
                  <div className="nav-item-icon" style={{ position: 'relative' }}>
                    {icon(isActive)}
                    {to === '/entrepreneur/chat' && CHAT_BADGE(unreadChat)}
                  </div>
                  <span className="nav-item-label">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
