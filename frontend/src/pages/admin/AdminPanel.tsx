import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { loginAdmin, getAdminEntrepreneurs, createAdminEntrepreneur, deleteAdminEntrepreneur, resolveAssetUrl, type AdminEntrepreneur } from '../../api/client'
import { formatPhone, capitalizeName } from '../../utils/format'

function AdminLogin() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useAuthStore(s => s.setAuth)

  const submit = async () => {
    if (!password) { setError('Введите пароль'); return }
    setLoading(true); setError('')
    try {
      const res = await loginAdmin(password)
      const { access_token, role, user_id, full_name } = res.data
      setAuth(access_token, role, user_id, full_name)
    } catch {
      setError('Неверный пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1A1A', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 340, background: 'white', borderRadius: 20, padding: '32px 28px', textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>Панель администратора</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 22 }}>Введите пароль для доступа</div>
        <input
          className="form-input"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ textAlign: 'center', marginBottom: 10 }}
          autoFocus
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ borderRadius: 12 }}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </div>
    </div>
  )
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FFF3EE', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 15, color: 'var(--orange)' }}>
      {url ? <img src={resolveAssetUrl(url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </div>
  )
}

function AddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+7')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('Введите имя ИП'); return }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 11) { setError('Введите полный номер телефона'); return }
    setLoading(true); setError('')
    try {
      await createAdminEntrepreneur(name.trim(), '+' + digits)
      onAdded()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось добавить ИП')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, padding: '22px 22px 24px' }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 16 }}>Добавить ИП</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase' }}>Имя / название</div>
        <input className="form-input" placeholder="ФИО или название ИП" value={name}
          onChange={e => { setName(capitalizeName(e.target.value)); setError('') }}
          style={{ marginBottom: 14 }} autoFocus />
        <div style={{ fontSize: 12, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase' }}>Телефон</div>
        <input className="form-input" placeholder="+7 (xxx) xxx-xx-xx" value={phone} type="tel"
          onChange={e => { setPhone(formatPhone(e.target.value)); setError('') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ marginBottom: 14 }} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={loading}
            style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Отмена
          </button>
          <button onClick={submit} disabled={loading}
            style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {loading ? '...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ ent, onClose, onDeleted }: { ent: AdminEntrepreneur; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)
  const hasData = ent.vehicles_count > 0 || ent.drivers_count > 0

  const submit = async () => {
    setLoading(true)
    try { await deleteAdminEntrepreneur(ent.id); onDeleted() }
    catch { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFF0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </div>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Удалить ИП?</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: hasData ? 10 : 24, lineHeight: 1.6 }}>
          {ent.full_name} будет удалён без возможности восстановления.
        </div>
        {hasData && (
          <div style={{ fontSize: 13, color: '#FF3B30', background: '#FFF0EF', borderRadius: 12, padding: '10px 14px', marginBottom: 20, lineHeight: 1.5 }}>
            Также будут удалены: {ent.vehicles_count} ТС и {ent.drivers_count} водител{ent.drivers_count === 1 ? 'ь' : 'ей'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={loading}
            style={{ flex: 1, padding: '13px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Отмена
          </button>
          <button onClick={submit} disabled={loading}
            style={{ flex: 1, padding: '13px', borderRadius: 50, border: 'none', background: '#FF3B30', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {loading ? '...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminEntrepreneurs() {
  const [list, setList] = useState<AdminEntrepreneur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [toDelete, setToDelete] = useState<AdminEntrepreneur | null>(null)
  const logout = useAuthStore(s => s.logout)
  const fullName = useAuthStore(s => s.fullName)

  const load = () => {
    setLoading(true)
    getAdminEntrepreneurs().then(r => setList(r.data)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const q = search.toLowerCase()
  const filtered = list.filter(e =>
    !q || e.full_name.toLowerCase().includes(q) || (e.phone ?? '').toLowerCase().includes(q)
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F2', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1A1A1A', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>Панель администратора</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{fullName}</div>
        </div>
        <button onClick={logout} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '7px 12px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Выйти
        </button>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="form-input" placeholder="Поиск по имени или телефону" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, background: 'white' }} />
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Всего ИП: {list.length}</span>
        <button onClick={() => setShowAdd(true)}
          style={{ background: 'var(--orange)', border: 'none', borderRadius: 20, padding: '9px 18px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          + Добавить ИП
        </button>
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            {search ? 'Ничего не найдено' : 'Пока нет ни одного ИП'}
          </div>
        ) : filtered.map(e => (
          <div key={e.id} className="card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar url={e.avatar_url} name={e.full_name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{e.full_name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {e.phone ?? '—'} · {e.vehicles_count} ТС · {e.drivers_count} водит.
              </div>
            </div>
            <button onClick={() => setToDelete(e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#FF3B30' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        ))}
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
      {toDelete && <DeleteModal ent={toDelete} onClose={() => setToDelete(null)} onDeleted={() => { setToDelete(null); load() }} />}
    </div>
  )
}

export default function AdminPanel() {
  const { token, role } = useAuthStore()
  if (token && role === 'admin') return <AdminEntrepreneurs />
  return <AdminLogin />
}
