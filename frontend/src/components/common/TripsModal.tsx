import { useState } from 'react'
import LogoLoader from './LogoLoader'
import { overrideTrip, type Trip } from '../../api/client'
import { tripDurationMin, isTripErroneous } from '../../utils/trips'

const fmtTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Список рейсов смены/отчёта. Рейсы со слишком короткой или слишком длинной
 * длительностью помечаются как ошибочные и не учитываются в подсчёте кругов —
 * но их можно подтвердить вручную кнопкой "Всё равно верный". */
export default function TripsModal({ title = 'Рейсы за смену', trips, loading, onClose, onTripsChange }: {
  title?: string; trips: Trip[] | null; loading: boolean; onClose: () => void
  onTripsChange?: (trips: Trip[]) => void
}) {
  const [pending, setPending] = useState<number | null>(null)

  const markValid = async (t: Trip) => {
    setPending(t.id)
    try {
      const res = await overrideTrip(t.id, true)
      onTripsChange?.((trips ?? []).map(x => x.id === t.id ? res.data : x))
    } catch {} finally { setPending(null) }
  }

  return (
    <div onClick={onClose}
      className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, maxHeight: 'calc(var(--app-vh, 100vh) * 0.75)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 22px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{title}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 22px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><LogoLoader size={36} /></div>
          ) : !trips || trips.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Нет данных о рейсах</div>
          ) : (
            trips.map((t, i) => {
              const durationMin = tripDurationMin(t)
              const erroneous = isTripErroneous(t)
              return (
                <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}. {t.start_terminal} → {t.end_terminal ?? '…'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {fmtTime(t.started_at)}–{t.ended_at ? fmtTime(t.ended_at) : '…'}{durationMin != null ? ` (${durationMin} мин)` : ''}
                      </div>
                    </div>
                  </div>
                  {erroneous && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, background: '#FFF0EF', borderRadius: 10, padding: '6px 10px' }}>
                      <span style={{ fontSize: 11, color: '#CC3333', fontWeight: 600, flex: 1 }}>Похоже на ошибку — не учтён в кругах</span>
                      <button onClick={() => markValid(t)} disabled={pending === t.id}
                        style={{ background: 'none', border: '1.5px solid #CC3333', borderRadius: 20, padding: '4px 10px', color: '#CC3333', fontWeight: 700, fontSize: 11, cursor: pending === t.id ? 'default' : 'pointer', flexShrink: 0 }}>
                        {pending === t.id ? '...' : 'Всё равно верный'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
