import { useRef, useState } from 'react'

// ДД.ММ.ГГГГ — точки подставляются сами после дня и месяца; каждая цифра
// подрезается посимвольно (день > 31, месяц > 12 ввести нельзя), а сама дата
// (например 31.02) проверяется только когда введены все 8 цифр.
function clampDateDigits(digits: string): string {
  digits = digits.slice(0, 8)
  if (digits.length >= 1 && digits[0] > '3') digits = '3' + digits.slice(1)
  if (digits.length >= 2 && digits[0] === '3' && digits[1] > '1') digits = digits[0] + '1' + digits.slice(2)
  if (digits.length >= 3 && digits[2] > '1') digits = digits.slice(0, 2) + '1' + digits.slice(3)
  if (digits.length >= 4 && digits[2] === '1' && digits[3] > '2') digits = digits.slice(0, 3) + '2' + digits.slice(4)
  return digits
}
function formatDateDigits(digits: string): string {
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}
function isValidCalendarDate(d: number, m: number, y: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}
// Год можно ввести двумя цифрами ("27") — достраивается до полного ("2027").
function draftToIso(raw: string): string | null {
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/)
  if (!m) return null
  const [, d, mo, yRaw] = m
  const y = yRaw.length === 2 ? '20' + yRaw : yRaw
  if (!isValidCalendarDate(Number(d), Number(mo), Number(y))) return null
  return `${y}-${mo}-${d}`
}
function isoToDraft(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Строка карточки с датой: значок календаря открывает нативный пикер, а клик
 * по самому значению — ручной ввод по шаблону ДД.ММ.ГГГГ с автоподстановкой
 * точек и валидацией при сохранении. */
export default function DateRow({ icon, label, value, onChange }: {
  icon: React.ReactNode; label: string; value: string; onChange: (iso: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const display = value ? `до ${value.split('-').reverse().map((p, i) => i === 2 ? p.slice(2) : p).join('.')}` : 'Выберите'

  const startEdit = () => {
    setDraft(value ? isoToDraft(value) : '')
    setErr(false)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const save = () => {
    if (draft.trim() === '') { setEditing(false); setErr(false); return }
    const iso = draftToIso(draft)
    if (!iso) { setErr(true); return }
    setEditing(false); setErr(false)
    if (iso !== value) onChange(iso)
  }

  return (
    <div>
      <div className="row-item">
        <div className="row-icon" style={{ background: '#FFF3EE', borderRadius: 8 }}>{icon}</div>
        <span className="row-label">{label}</span>
        {editing ? (
          <input ref={inputRef} value={draft} inputMode="numeric" maxLength={10} placeholder="ДД.ММ.ГГГГ"
            onChange={e => setDraft(formatDateDigits(clampDateDigits(e.target.value.replace(/\D/g, ''))))}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') { save(); return }
              // Backspace ровно на границе "ДД.|" или "ДД.ММ.|" — без перехвата
              // стирание просто восстанавливает ту же точку обратно.
              if (e.key === 'Backspace') {
                const el = e.currentTarget
                const pos = el.selectionStart
                if (el.selectionStart === el.selectionEnd && (pos === 3 || pos === 6) && draft[pos - 1] === '.') {
                  e.preventDefault()
                  setDraft(formatDateDigits(draft.replace(/\D/g, '').slice(0, -1)))
                }
              }
            }}
            style={{ flex: 1, textAlign: 'right', border: 'none', borderBottom: `1.5px solid ${err ? '#FF3B30' : 'var(--orange)'}`, background: 'transparent', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: err ? '#FF3B30' : 'var(--orange)', width: 100 }} />
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span onClick={startEdit} style={{ fontSize: 13, color: value ? 'var(--orange)' : 'var(--text-muted)', fontWeight: value ? 600 : 400, cursor: 'pointer' }}>{display}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <input type="date" value={value}
              onChange={e => onChange(e.target.value)}
              style={{ position: 'absolute', right: 0, top: 0, width: 18, height: 18, opacity: 0, cursor: 'pointer' }} />
          </div>
        )}
      </div>
      {err && <div style={{ fontSize: 11, color: '#FF3B30', padding: '0 16px 8px 52px' }}>Формат ДД.ММ.ГГГГ</div>}
    </div>
  )
}
