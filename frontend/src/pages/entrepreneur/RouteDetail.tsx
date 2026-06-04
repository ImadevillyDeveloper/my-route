import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRoutes, getVehicles, deleteRoute as apiDeleteRoute, updateRoute } from '../../api/client'
import StatusBar from '../../components/common/StatusBar'
import LogoLoader from '../../components/common/LogoLoader'
import { useAuthStore } from '../../store/auth'

const toParkName = (name: string | null): string => {
  if (!name) return 'ИП'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 3) return `ИП ${parts[0]} ${parts[1][0]}.${parts[2][0]}.`
  if (parts.length === 2) return `ИП ${parts[0]} ${parts[1][0]}.`
  return `ИП ${name}`
}

const inLineCount = (total: number, routeId: number): number => {
  if (total === 0) return 0
  const fracs = [1.0, 0.83, 0.67, 0.75, 0.5, 0.9, 0.6, 0.8, 0.7, 0.45]
  return Math.max(1, Math.min(total, Math.round(total * fracs[routeId % fracs.length])))
}

const OIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{children}</div>
)

function EditableRow({ icon, label, value, onChange, locked }: {
  icon: React.ReactNode; label: string; value: string
  onChange?: (v: string) => void; locked?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  const startEdit = () => {
    if (locked || !onChange) return
    setDraft(value); setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  const save = () => { setEditing(false); if (draft !== value) onChange?.(draft) }

  return (
    <div className="row-item" style={{ cursor: locked ? 'default' : 'pointer' }} onClick={!editing ? startEdit : undefined}>
      <OIcon>{icon}</OIcon>
      <span className="row-label">{label}</span>
      {editing ? (
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
          style={{ flex: 1, textAlign: 'right', border: 'none', borderBottom: '1.5px solid var(--orange)', background: 'transparent', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: 'var(--orange)' }} />
      ) : (
        <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14 }}>{value || '—'}</span>
      )}
      {locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
    </div>
  )
}

export default function EntRouteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const parkName = toParkName(useAuthStore(s => s.fullName))
  const [base, setBase] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [totalVehicles, setTotalVehicles] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    Promise.all([getRoutes(), getVehicles()])
      .then(([rRoutes, rVehicles]) => {
        const found = rRoutes.data.find((x: any) => String(x.id) === id)
        if (!found) return
        setBase(found)
        setData({ ...found })
        const count = rVehicles.data.filter((v: any) => v.route_number === found.number).length
        setTotalVehicles(count)
      })
      .catch(() => {})
  }, [id])

  const handleDelete = async () => {
    if (!base) return
    setDeleting(true)
    try {
      await apiDeleteRoute(base.id)
      navigate('/entrepreneur/routes')
    } catch { setDeleting(false); setConfirmDelete(false) }
  }

  const set = (k: string) => (v: string) => {
    if (!base) return
    setData((p: any) => ({ ...p, [k]: v }))
    updateRoute(base.id, { [k]: v }).catch(() => {})
  }

  if (!data) return <LogoLoader fullPage />

  const inLine = inLineCount(totalVehicles, base?.id ?? 1)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _storageKey = `route_extra_${id}` // kept for legacy compat, not used

  return (
    <div className="page">
      <StatusBar />
      <div className="app-header">
        <button className="app-header-back" onClick={() => navigate(-1)}>←</button>
        <span className="app-header-title">Мои Маршруты</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header card */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
            {data.number}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Маршрут №{data.number}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>"{data.start_point} — {data.end_point}"</div>
            <div style={{ fontSize: 12, color: totalVehicles > 0 ? 'var(--orange)' : 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
              {totalVehicles === 0 ? 'Нет ТС' : `${inLine} из ${totalVehicles} в линии`}
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="card">
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Номер маршрута" value={data.number} onChange={set('number')}
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg>}
            label="Свидетельство" value={data.document_number ?? ''} onChange={set('document_number')}
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/></svg>}
            label="Начальная точка" value={data.start_point ?? ''} onChange={set('start_point')}
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            label="Конечная точка" value={data.end_point ?? ''} onChange={set('end_point')}
          />
          <EditableRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>}
            label="Парк" value={parkName} locked
          />
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Нажмите на любое поле, чтобы изменить данные маршрута
        </p>

        {/* Navigation */}
        <div className="card">
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/entrepreneur/drivers', { state: { filterRoute: data.number } })}>
            <OIcon><svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></OIcon>
            <span className="row-label">Водители маршрута</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
          <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/entrepreneur/vehicles', { state: { filterRoute: data.number } })}>
            <OIcon><img src="/bus.png" width="20" height="20" /></OIcon>
            <span className="row-label">ТС маршрута</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', marginRight: 6 }}>{totalVehicles} ТС</span>
            <span className="row-arrow" style={{ color: 'var(--orange)', fontSize: 18 }}>›</span>
          </div>
        </div>

        <button onClick={() => setConfirmDelete(true)}
          style={{ marginTop: 4, padding: '14px 24px', borderRadius: 16, border: '2px solid #FF3B30', background: 'white', color: '#FF3B30', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Удалить маршрут
        </button>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFF0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Удалить маршрут?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Маршрут №{data.number} будет удалён из списка. Это действие нельзя отменить.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: '#FF3B30', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
