import { useEffect, useRef, useState } from 'react'
import { getChatConversations, getChatMessages, postChatMessage } from '../../api/client'
import LogoLoader from '../common/LogoLoader'

interface Conversation {
  key: string
  type: 'route' | 'dm'
  title: string
  other_user_id?: number | null
  unread: number
  last_message?: string | null
  last_message_at?: string | null
}

interface ChatMessage {
  id: number
  conversation_key: string
  sender_id: number
  sender_name: string
  sender_role: string
  text: string
  created_at: string
  mine: boolean
}

const ICON_ROUTE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="6" cy="7" r="3"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M17 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const ICON_DM = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)

const timeLabel = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export default function ChatScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadedList, setLoadedList] = useState(false)
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const activeKeyRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const loadConversations = () => {
    getChatConversations().then(r => { setConversations(r.data); setLoadedList(true) }).catch(() => setLoadedList(true))
  }

  useEffect(() => {
    loadConversations()
    const t = setInterval(loadConversations, 8000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { activeKeyRef.current = active?.key ?? null }, [active])

  const loadMessages = (key: string) => {
    getChatMessages(key).then(r => {
      if (activeKeyRef.current !== key) return
      setMessages(r.data)
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 30)
    }).catch(() => {})
  }

  useEffect(() => {
    if (!active) return
    loadMessages(active.key)
    const t = setInterval(() => loadMessages(active.key), 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key])

  const openConversation = (c: Conversation) => {
    setMessages([])
    setActive(c)
  }

  const send = async () => {
    const value = text.trim()
    if (!value || !active || sending) return
    setSending(true)
    setText('')
    try {
      const res = await postChatMessage(active.key, value)
      setMessages(prev => [...prev, res.data])
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 30)
      loadConversations()
    } catch {
      setText(value)
    } finally {
      setSending(false)
    }
  }

  // ── Thread view ──────────────────────────────────────────────────
  if (active) {
    return (
      <div className="map-page-root" style={{ display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setActive(null)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'white' }}>{active.type === 'route' ? ICON_ROUTE : ICON_DM}</span>
          </div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>{active.title}</div>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: '#F7F7F7' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>
              Сообщений пока нет. Напишите первым!
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
              {active.type === 'route' && !m.mine && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, marginLeft: 4 }}>
                  {m.sender_name}{m.sender_role === 'entrepreneur' ? ' · ИП' : ''}
                </span>
              )}
              <div style={{
                maxWidth: '78%', padding: '9px 13px', borderRadius: 16,
                background: m.mine ? 'var(--orange)' : 'white',
                color: m.mine ? 'white' : 'var(--text-primary)',
                boxShadow: m.mine ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word',
              }}>
                {m.text}
              </div>
              <span style={{ fontSize: 10, color: '#AAA', marginTop: 2, marginRight: m.mine ? 4 : 0, marginLeft: m.mine ? 0 : 4 }}>
                {timeLabel(m.created_at)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '10px 12px', paddingBottom: 'calc(10px + var(--nav-safe))', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Сообщение..."
            rows={1}
            style={{ flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 20, padding: '10px 16px', fontSize: 14, fontFamily: 'inherit', maxHeight: 100 }}
          />
          <button onClick={send} disabled={!text.trim() || sending}
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: text.trim() ? 'var(--orange)' : '#E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
      </div>
    )
  }

  // ── Conversation list view ────────────────────────────────────────
  return (
    <div className="page">
      <div className="app-header">
        <span className="app-header-title">Чат</span>
      </div>

      {!loadedList ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LogoLoader size={48} /></div>
      ) : conversations.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '40px 20px' }}>
          Чаты пока недоступны
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {conversations.map(c => (
            <div key={c.key} onClick={() => openConversation(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {c.type === 'route' ? ICON_ROUTE : ICON_DM}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</span>
                  {c.last_message_at && <span style={{ fontSize: 11, color: '#AAA', flexShrink: 0 }}>{timeLabel(c.last_message_at)}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.last_message ?? (c.type === 'route' ? 'Общий чат маршрута' : 'Личные сообщения')}
                  </span>
                  {c.unread > 0 && (
                    <span style={{ background: 'var(--orange)', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0, marginLeft: 8 }}>
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
