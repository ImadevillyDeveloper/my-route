export default function StatusBar({ dark = false }: { dark?: boolean }) {
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const bg = dark ? '#1A1A1A' : 'var(--orange)'
  return (
    <div className="status-bar" style={{ background: bg, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
      <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
          <rect x="0" y="8" width="3" height="4" rx="0.5"/>
          <rect x="4.5" y="5" width="3" height="7" rx="0.5"/>
          <rect x="9" y="2" width="3" height="10" rx="0.5"/>
          <rect x="13.5" y="0" width="2.5" height="12" rx="0.5"/>
        </svg>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>LTE</span>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="white" strokeOpacity="0.4"/>
          <rect x="22" y="4" width="2.5" height="4" rx="1" fill="white" fillOpacity="0.4"/>
          <rect x="2" y="2" width="16" height="8" rx="1.5" fill="white"/>
        </svg>
      </div>
    </div>
  )
}
