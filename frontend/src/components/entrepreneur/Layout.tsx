import { Outlet, NavLink } from 'react-router-dom'

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
                  <div className="sidebar-item-icon">{icon(isActive)}</div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </aside>

      <div className="page">
        <Outlet />
        <nav className="bottom-nav">
          {navItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              {({ isActive }) => (
                <>
                  <div className="nav-item-icon">{icon(isActive)}</div>
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
