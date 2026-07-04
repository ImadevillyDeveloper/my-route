import { useEffect, useRef, useState } from 'react'
import {
  getChatConversations, getChatMessages, postChatMessage, getChatRouteMembers, setChatConversationState,
  resolveAssetUrl, editChatMessage, deleteChatMessage, getChatGroup, uploadChatGroupAvatar,
  addChatGroupAdmin, removeChatGroupAdmin,
} from '../../api/client'
import LogoLoader from '../common/LogoLoader'

interface Conversation {
  key: string
  type: 'route' | 'dm'
  title: string
  other_user_id?: number | null
  avatar_url?: string | null
  unread: number
  last_message?: string | null
  last_message_at?: string | null
  pinned?: boolean
}

interface RouteMember {
  id: number
  full_name: string
  avatar_url?: string | null
  dm_key: string
  is_admin: boolean
  is_owner: boolean
}

interface GroupInfo {
  conversation_key: string
  avatar_url?: string | null
  is_admin: boolean
  is_owner: boolean
}

interface ChatMessage {
  id: number
  conversation_key: string
  sender_id: number
  sender_name: string
  sender_role: string
  sender_avatar_url?: string | null
  text: string
  created_at: string
  mine: boolean
  edited: boolean
  deleted: boolean
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
const ICON_MEMBERS = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const Avatar = ({ url, fallback, size = 44, bg = '#FFF3EE' }: { url?: string | null; fallback: React.ReactNode; size?: number; bg?: string }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
    {url ? <img src={resolveAssetUrl(url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : fallback}
  </div>
)
const ICON_PIN_SMALL = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22"/>
    <path d="M5 17h14l-2-3.5V7a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v6.5L5 17z" fill="var(--orange)" stroke="none"/>
  </svg>
)
const ICON_CAMERA = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
  </svg>
)
const ICON_SHIELD = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--orange)" stroke="none"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg>
)

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('ru-RU', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

const messageTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

const highlight = (text: string, q: string) => {
  if (!q || !text.toLowerCase().includes(q)) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q)
  return <>{text.slice(0, idx)}<span style={{ color: 'var(--orange)', fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>
}

export default function ChatScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadedList, setLoadedList] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuConv, setMenuConv] = useState<Conversation | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<RouteMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [msgMenu, setMsgMenu] = useState<ChatMessage | null>(null)
  const activeKeyRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const groupAvatarInputRef = useRef<HTMLInputElement>(null)

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
    setGroupInfo(null)
    setEditingId(null)
    setText('')
    setActive(c)
  }

  const openMembers = () => {
    if (!active || active.type !== 'route') return
    const routeNumber = active.key.split(':')[1]
    setShowMembers(true)
    setMembersLoading(true)
    Promise.all([
      getChatRouteMembers(routeNumber).then(r => setMembers(r.data)).catch(() => setMembers([])),
      getChatGroup(active.key).then(r => setGroupInfo(r.data)).catch(() => setGroupInfo(null)),
    ]).finally(() => setMembersLoading(false))
  }

  const openMemberDm = (m: RouteMember) => {
    setShowMembers(false)
    openConversation({ key: m.dm_key, type: 'dm', title: m.full_name, unread: 0 })
  }

  const pickGroupAvatar = () => groupAvatarInputRef.current?.click()

  const onGroupAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !active) return
    setAvatarUploading(true)
    try {
      const res = await uploadChatGroupAvatar(active.key, file)
      setGroupInfo(res.data)
      setActive(prev => prev ? { ...prev, avatar_url: res.data.avatar_url } : prev)
      loadConversations()
    } catch {}
    finally { setAvatarUploading(false) }
  }

  const toggleMemberAdmin = async (m: RouteMember) => {
    if (!active) return
    try {
      if (m.is_admin) await removeChatGroupAdmin(active.key, m.id)
      else await addChatGroupAdmin(active.key, m.id)
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, is_admin: !x.is_admin } : x))
    } catch {}
  }

  const toggleSearch = () => {
    setSearchOpen(o => {
      const next = !o
      if (!next) setSearch('')
      return next
    })
    setTimeout(() => searchInputRef.current?.focus(), 30)
  }

  const togglePin = (c: Conversation) => {
    setChatConversationState(c.key, { pinned: !c.pinned }).then(loadConversations).catch(() => {})
    setMenuConv(null)
  }

  const deleteConversation = (c: Conversation) => {
    setChatConversationState(c.key, { hidden: true }).then(loadConversations).catch(() => {})
    setConversations(prev => prev.filter(x => x.key !== c.key))
    setMenuConv(null)
  }

  const send = async () => {
    const value = text.trim()
    if (!value || !active || sending) return
    setSending(true)
    if (editingId != null) {
      const id = editingId
      setText('')
      setEditingId(null)
      try {
        const res = await editChatMessage(id, value)
        setMessages(prev => prev.map(m => m.id === id ? res.data : m))
      } catch {
        setText(value)
        setEditingId(id)
      } finally {
        setSending(false)
      }
      return
    }
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

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id)
    setText(m.text)
    setMsgMenu(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setText('')
  }

  const removeMessage = async (m: ChatMessage) => {
    setMsgMenu(null)
    try {
      await deleteChatMessage(m.id)
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, deleted: true, text: '' } : x))
      loadConversations()
    } catch {}
  }

  // ── Thread view ──────────────────────────────────────────────────
  if (active) {
    return (
      <div className="map-page-root" style={{ display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setActive(null); setEditingId(null); setText('') }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <Avatar url={active.avatar_url} fallback={active.type === 'route' ? ICON_ROUTE : ICON_DM} size={34} bg="rgba(255,255,255,0.2)" />
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.title}</div>
          {active.type === 'route' && (
            <button onClick={openMembers}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
              {ICON_MEMBERS}
            </button>
          )}
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: '#F7F7F7' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>
              Сообщений пока нет. Напишите первым!
            </div>
          )}
          {messages.map((m, i) => {
            const showAvatar = active.type === 'route' && !m.mine
            const prev = messages[i - 1]
            const showDayDivider = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {showDayDivider && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 10px' }}>
                    <span style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 12 }}>
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: '78%' }}>
                  {showAvatar && <Avatar url={m.sender_avatar_url} fallback={ICON_DM} size={26} />}
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
                    {showAvatar && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, marginLeft: 4 }}>
                        {m.sender_name}{m.sender_role === 'entrepreneur' ? ' · ИП' : ''}
                      </span>
                    )}
                    <div
                      onClick={() => { if (m.mine && !m.deleted) setMsgMenu(m) }}
                      style={{
                        padding: '9px 13px', borderRadius: 16,
                        background: m.deleted ? (m.mine ? 'rgba(255,255,255,0.25)' : '#EFEFEF') : (m.mine ? 'var(--orange)' : 'white'),
                        color: m.deleted ? (m.mine ? 'rgba(255,255,255,0.8)' : '#999') : (m.mine ? 'white' : 'var(--text-primary)'),
                        boxShadow: (m.mine || m.deleted) ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                        fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word',
                        fontStyle: m.deleted ? 'italic' : 'normal',
                        cursor: (m.mine && !m.deleted) ? 'pointer' : 'default',
                      }}>
                      {m.deleted ? 'Сообщение удалено' : m.text}
                    </div>
                    <span style={{ fontSize: 10, color: '#AAA', marginTop: 2, marginRight: m.mine ? 4 : 0, marginLeft: m.mine ? 0 : 4 }}>
                      {messageTime(m.created_at)}{m.edited && !m.deleted ? ' · изменено' : ''}
                    </span>
                  </div>
                </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ background: 'white', borderTop: '1px solid var(--border)' }}>
          {editingId != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #F0F0F0', background: '#FFF8F3' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600, flex: 1 }}>Редактирование сообщения</span>
              <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
          )}
          <div style={{ padding: '10px 12px', paddingBottom: 'calc(10px + var(--nav-safe))', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } if (e.key === 'Escape' && editingId != null) cancelEdit() }}
              placeholder="Сообщение..."
              rows={1}
              style={{ flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 20, padding: '10px 16px', fontSize: 14, fontFamily: 'inherit', maxHeight: 100 }}
            />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: text.trim() ? 'var(--orange)' : '#E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
              {editingId != null
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
              }
            </button>
          </div>
        </div>

        {showMembers && (
          <div onClick={() => setShowMembers(false)}
            className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 430, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{groupInfo?.is_admin ? 'Группа маршрута' : 'Участники маршрута'}</span>
                <button onClick={() => setShowMembers(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
              </div>

              {groupInfo?.is_admin && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 20px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
                  <div onClick={avatarUploading ? undefined : pickGroupAvatar} style={{ position: 'relative', cursor: avatarUploading ? 'default' : 'pointer' }}>
                    <Avatar url={groupInfo.avatar_url} fallback={ICON_ROUTE} size={72} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%', background: 'var(--orange)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {avatarUploading ? <LogoLoader size={14} /> : ICON_CAMERA}
                    </div>
                  </div>
                  <input ref={groupAvatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onGroupAvatarChange} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Аватар группы виден всем участникам</span>
                </div>
              )}

              <div style={{ overflowY: 'auto' }}>
                {membersLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><LogoLoader size={40} /></div>
                ) : members.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '24px 20px' }}>
                    Других водителей на маршруте пока нет
                  </div>
                ) : (
                  members.map(m => (
                    <div key={m.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid #F5F5F5' }}>
                      <div onClick={() => openMemberDm(m)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                        <Avatar url={m.avatar_url} fallback={ICON_DM} size={38} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</span>
                          {m.is_admin && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#FFF3EE', borderRadius: 8, padding: '2px 7px', flexShrink: 0 }}>
                              {ICON_SHIELD}<span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)' }}>Админ</span>
                            </span>
                          )}
                        </span>
                      </div>
                      {groupInfo?.is_owner ? (
                        <button onClick={() => toggleMemberAdmin(m)}
                          style={{ background: m.is_admin ? '#F5F5F5' : '#FFF3EE', border: 'none', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: m.is_admin ? '#999' : 'var(--orange)', cursor: 'pointer', flexShrink: 0 }}>
                          {m.is_admin ? 'Снять права' : 'Сделать админом'}
                        </button>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {msgMenu && (
          <div onClick={() => setMsgMenu(null)}
            className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 430, paddingBottom: 'var(--nav-safe)' }}>
              <div onClick={() => startEdit(msgMenu)}
                style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', borderBottom: '1px solid #F5F5F5' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Редактировать</span>
              </div>
              <div onClick={() => removeMessage(msgMenu)}
                style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#FF3B30' }}>Удалить</span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Conversation list view ────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const filteredConversations = q
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(q) || (c.last_message ?? '').toLowerCase().includes(q)
      )
    : conversations

  return (
    <div className="page">
      <div className="app-header">
        <span className="app-header-title" style={{ flex: searchOpen ? '0 0 auto' : 1 }}>Чат</span>
        {searchOpen && (
          <input
            ref={searchInputRef}
            className="chat-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по чатам..."
            style={{ flex: 1, minWidth: 0, fontSize: 14, background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 20, padding: '7px 14px', color: 'white' }}
          />
        )}
        <button className="app-header-action" onClick={toggleSearch}>
          {searchOpen
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          }
        </button>
      </div>

      {!loadedList ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LogoLoader size={48} /></div>
      ) : conversations.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '40px 20px' }}>
          Чаты пока недоступны
        </div>
      ) : filteredConversations.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '40px 20px' }}>
          Ничего не найдено
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {filteredConversations.map(c => (
            <div key={c.key} onClick={() => openConversation(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 8px 13px 16px', cursor: 'pointer', borderBottom: '1px solid #F0F0F0', background: c.pinned ? '#FFFBF7' : 'white' }}>
              <Avatar url={c.avatar_url} fallback={c.type === 'route' ? ICON_ROUTE : ICON_DM} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    {c.pinned && ICON_PIN_SMALL}
                    <span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlight(c.title, q)}</span>
                  </span>
                  {c.last_message_at && <span style={{ fontSize: 11, color: '#AAA', flexShrink: 0 }}>{messageTime(c.last_message_at)}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.last_message ? highlight(c.last_message, q) : (c.type === 'route' ? 'Общий чат маршрута' : 'Личные сообщения')}
                  </span>
                  {c.unread > 0 && (
                    <span style={{ background: 'var(--orange)', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0, marginLeft: 8 }}>
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); setMenuConv(c) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 6px', flexShrink: 0, color: '#BBB', fontSize: 18, lineHeight: 1 }}>
                ⋮
              </button>
            </div>
          ))}
        </div>
      )}

      {menuConv && (
        <div onClick={() => setMenuConv(null)}
          className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 430, paddingBottom: 'var(--nav-safe)' }}>
            <div style={{ padding: '16px 20px 10px', fontWeight: 800, fontSize: 15, borderBottom: '1px solid #F0F0F0' }}>{menuConv.title}</div>
            <div onClick={() => togglePin(menuConv)}
              style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', borderBottom: '1px solid #F5F5F5' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-2-3.5V7a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v6.5L5 17z"/></svg>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{menuConv.pinned ? 'Открепить чат' : 'Закрепить чат'}</span>
            </div>
            <div onClick={() => deleteConversation(menuConv)}
              style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#FF3B30' }}>Удалить чат</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
