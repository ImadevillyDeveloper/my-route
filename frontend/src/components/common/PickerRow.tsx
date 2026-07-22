import { useEffect, useRef, useState } from 'react'
import LogoLoader from './LogoLoader'

/** Стилизованный выпадающий список вместо системного <select> — карточка со
 * скруглёнными углами, тенью и подсветкой при наведении. Открывающееся меню
 * рисуется через position:fixed (иначе его обрезала бы родительская .card с
 * overflow:hidden), поэтому при скролле координаты пересчитываются вручную —
 * без этого меню осталось бы висеть на месте открытия, оторвавшись от поля.
 *
 * icon передаётся уже обёрнутым в нужный вид (у каждого экрана свой стиль
 * иконки-кружка) — этот компонент его не оборачивает повторно. */
export default function PickerRow({ icon, label, value, options, editable, onChange, loading, emptyText, changed, placeholder = 'Выберите' }: {
  icon: React.ReactNode; label: string; value: string; options: string[]; editable?: boolean
  onChange?: (v: string) => void; loading?: boolean; emptyText?: string; changed?: boolean; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const rowRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const reposition = () => {
    if (!rowRef.current) return
    const r = rowRef.current.getBoundingClientRect()
    const width = 220
    setPos({ top: r.bottom + 4, left: Math.max(14, r.right - width), width })
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node) && !rowRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // capture:true — ловим скролл любого промежуточного контейнера, не только окна
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { reposition(); raf = 0 })
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [open])

  const toggle = () => {
    if (!editable) return
    if (!open) reposition()
    setOpen(o => !o)
  }

  return (
    <div ref={rowRef} className="row-item" style={{ cursor: editable ? 'pointer' : 'default' }} onClick={toggle}>
      {icon}
      <span className="row-label">{label}</span>
      <span style={{ fontWeight: 600, fontSize: 15, color: !value ? (editable ? '#FF3B30' : 'var(--text-muted)') : changed ? 'var(--orange)' : 'var(--text-primary)' }}>
        {value || (editable ? placeholder : '—')}
      </span>
      {editable && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginLeft: 4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      )}

      {open && (
        <div ref={boxRef} onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)', zIndex: 2000, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}><LogoLoader size={26} /></div>
          ) : options.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{emptyText ?? 'Нет вариантов'}</div>
          ) : options.map((o, i) => (
            <div key={o} onMouseDown={() => { onChange?.(o); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, fontWeight: o === value ? 700 : 500, color: o === value ? 'var(--orange)' : 'var(--text-primary)', background: o === value ? '#FFF3EE' : 'white', borderBottom: i < options.length - 1 ? '1px solid #F5F5F5' : 'none' }}
              onMouseEnter={e => { if (o !== value) e.currentTarget.style.background = '#FAFAFA' }}
              onMouseLeave={e => { if (o !== value) e.currentTarget.style.background = 'white' }}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
