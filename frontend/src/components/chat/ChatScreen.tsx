import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getChatConversations, getChatMessages, postChatMessage, getChatRouteMembers, setChatConversationState,
  resolveAssetUrl, editChatMessage, deleteChatMessage, getChatGroup, uploadChatGroupAvatar,
  addChatGroupAdmin, removeChatGroupAdmin, clearChatConversation, updateChatGroupTitle, removeChatGroupMember,
  uploadChatAttachment,
} from '../../api/client'
import LogoLoader from '../common/LogoLoader'
import { useAuthStore } from '../../store/auth'

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
  online?: boolean
  last_seen_at?: string | null
}

interface RouteMember {
  id: number
  full_name: string
  avatar_url?: string | null
  dm_key: string
  is_admin: boolean
  is_owner: boolean
  is_me: boolean
  online: boolean
  last_seen_at?: string | null
}

interface GroupInfo {
  conversation_key: string
  avatar_url?: string | null
  title?: string | null
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
  read: boolean
  attachment_url?: string | null
  attachment_type?: 'image' | 'file' | 'voice' | 'video_note' | null
  attachment_name?: string | null
  attachment_size?: number | null
  attachment_duration?: number | null
  pending?: boolean
  failed?: boolean
  localUrl?: string
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

const Avatar = ({ url, fallback, size = 44, bg = '#FFF3EE', online }: { url?: string | null; fallback: React.ReactNode; size?: number; bg?: string; online?: boolean }) => (
  <div style={{ position: 'relative', flexShrink: 0 }}>
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {url ? <img src={resolveAssetUrl(url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : fallback}
    </div>
    {online && (
      <span style={{ position: 'absolute', bottom: 0, right: 0, width: Math.max(9, Math.round(size * 0.26)), height: Math.max(9, Math.round(size * 0.26)), borderRadius: '50%', background: '#4CAF50', border: '2px solid white' }} />
    )}
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

const ReadTicks = ({ read }: { read: boolean }) => (
  <svg width="15" height="10" viewBox="0 0 15 10" fill="none" stroke={read ? '#34B7F1' : '#AAA'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 5.5L4 8.5L9.5 1.5"/>
    {read && <path d="M5.5 5.5L8.5 8.5L14 1.5"/>}
  </svg>
)

const PendingSpinner = ({ size = 11, color = '#AAA' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" opacity="0.3" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
)

const FailedBadge = ({ size = 13 }: { size?: number }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: '#FF3B30', color: 'white', fontSize: size * 0.7, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}>!</span>
)

const MediaStatusOverlay = ({ pending, failed, round }: { pending?: boolean; failed?: boolean; round?: boolean }) => {
  if (!pending && !failed) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: round ? '50%' : 12,
      background: failed ? 'rgba(255,59,48,0.3)' : 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
    }}>
      {failed ? <FailedBadge size={28} /> : <PendingSpinner size={26} color="white" />}
    </div>
  )
}

const useMediaPlayback = (mediaRef: React.RefObject<HTMLMediaElement>, knownDuration?: number | null) => {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(knownDuration ?? 0)

  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    const onTime = () => { setCurrentTime(el.currentTime); if (el.duration && isFinite(el.duration)) setProgress(el.currentTime / el.duration) }
    const onLoaded = () => { if (el.duration && isFinite(el.duration)) setDuration(el.duration) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => { setPlaying(false); setProgress(0); setCurrentTime(0) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('durationchange', onLoaded)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('durationchange', onLoaded)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { playing, progress, currentTime, duration }
}

const iconPlay = (color: string) => <svg width="13" height="13" viewBox="0 0 24 24" fill={color}><path d="M6 4l14 8-14 8z" /></svg>
const iconPause = (color: string) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={color}><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
)

const VoiceMessagePlayer = ({ src, mine, knownDuration }: { src: string; mine: boolean; knownDuration?: number | null }) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const { playing, progress, currentTime, duration } = useMediaPlayback(audioRef as React.RefObject<HTMLMediaElement>, knownDuration)

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    const el = audioRef.current
    if (!el) return
    if (playing) el.pause(); else el.play().catch(() => {})
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const el = audioRef.current
    const bar = barRef.current
    if (!el || !bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    el.currentTime = ratio * duration
  }

  const accent = mine ? 'white' : 'var(--orange)'
  const trackBg = mine ? 'rgba(255,255,255,0.35)' : '#E5E5E5'
  const shownSeconds = currentTime > 0 ? currentTime : duration

  return (
    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 190 }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />
      <button onClick={togglePlay}
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: mine ? 'rgba(255,255,255,0.22)' : '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        {playing ? iconPause(accent) : iconPlay(accent)}
      </button>
      <div ref={barRef} onClick={seek} style={{ position: 'relative', flex: 1, minWidth: 60, height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ height: 3, borderRadius: 2, background: trackBg, width: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: accent, borderRadius: 2 }} />
        </div>
        <div style={{ position: 'absolute', left: `calc(${progress * 100}% - 5px)`, width: 10, height: 10, borderRadius: '50%', background: accent, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
      <span style={{ fontSize: 11, opacity: 0.75, flexShrink: 0, minWidth: 26, textAlign: 'right' }}>{formatDuration(Math.round(shownSeconds))}</span>
    </div>
  )
}

const VideoNoteMessagePlayer = ({ src, pending, failed }: { src: string; pending?: boolean; failed?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { playing, progress, currentTime, duration } = useMediaPlayback(videoRef as React.RefObject<HTMLMediaElement>)
  const SIZE = 200
  const R = 96
  const C = 2 * Math.PI * R
  const dash = C * Math.min(1, Math.max(0, progress))

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pending || failed) return
    const el = videoRef.current
    if (!el) return
    if (playing) el.pause(); else el.play().catch(() => {})
  }

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
      <video ref={videoRef} src={src} playsInline onClick={toggle}
        style={{ width: SIZE, height: SIZE, borderRadius: '50%', objectFit: 'cover', display: 'block', background: '#000', cursor: 'pointer' }} />
      {!pending && !failed && (
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: 'rotate(-90deg)' }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
          {progress > 0 && (
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="white" strokeWidth="3"
              strokeDasharray={`${dash} ${C - dash}`} strokeLinecap="round" />
          )}
        </svg>
      )}
      {!playing && !pending && !failed && (
        <div onClick={toggle} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.15)', borderRadius: '50%' }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
        </div>
      )}
      <MediaStatusOverlay pending={pending} failed={failed} round />
      {!pending && !failed && (
        <>
          <span style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12, pointerEvents: 'none' }}>
            {formatDuration(Math.round(currentTime))}
          </span>
          <span style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12, pointerEvents: 'none' }}>
            {formatDuration(Math.round(duration))}
          </span>
        </>
      )}
    </div>
  )
}

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

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`
}

const iconFile = (color: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
)
const iconDownload = (color: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
)

// Neutral phrasing ("в сети"/relative time) since we don't track user gender for "был/была".
const lastSeenLabel = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diffSec < 60) return 'не в сети · только что'
  if (diffSec < 3600) return `не в сети · ${Math.floor(diffSec / 60)} мин. назад`
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return `не в сети · сегодня в ${messageTime(iso)}`
  if (diffDays === 1) return `не в сети · вчера в ${messageTime(iso)}`
  const sameYear = d.getFullYear() === now.getFullYear()
  const dateStr = d.toLocaleDateString('ru-RU', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
  return `не в сети · ${dateStr}`
}

const presenceLabel = (online: boolean, lastSeenAt?: string | null) => {
  if (online) return 'в сети'
  if (!lastSeenAt) return null
  return lastSeenLabel(lastSeenAt)
}

const highlight = (text: string, q: string) => {
  if (!q || !text.toLowerCase().includes(q)) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q)
  return <>{text.slice(0, idx)}<span style={{ color: 'var(--orange)', fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>
}

const ICON_PIN_WHITE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22"/>
    <path d="M5 17h14l-2-3.5V7a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v6.5L5 17z" fill="white" stroke="none"/>
  </svg>
)
const ICON_TRASH_WHITE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const SWIPE_MAX = 88
const SWIPE_THRESHOLD = 60
const CLICK_SUPPRESS_THRESHOLD = 15  // ignore incidental jitter from a real mouse/trackpad click
const LONG_PRESS_MS = 450
const LONG_PRESS_MOVE_TOLERANCE = 10

const SwipeableChatRow = ({ children, rightLabel, leftLabel, onSwipeRight, onSwipeLeft }: {
  children: React.ReactNode
  rightLabel: string
  leftLabel: string
  onSwipeRight: () => void
  onSwipeLeft: () => void
}) => {
  const [dx, setDx] = useState(0)
  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, dragging: true, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !d.dragging) return
    const deltaX = e.clientX - d.startX
    const deltaY = e.clientY - d.startY
    if (!d.moved && Math.abs(deltaX) < 6) return
    if (Math.abs(deltaY) > Math.abs(deltaX)) return
    d.moved = true
    setDx(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, deltaX)))
  }
  const endDrag = () => {
    const d = dragRef.current
    if (d?.moved) {
      if (Math.abs(dx) > CLICK_SUPPRESS_THRESHOLD) suppressClickRef.current = true
      if (dx > SWIPE_THRESHOLD) onSwipeRight()
      else if (dx < -SWIPE_THRESHOLD) onSwipeLeft()
    }
    dragRef.current = null
    setDx(0)
  }
  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
        <div style={{ flex: 1, background: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 20, opacity: dx > 10 ? 1 : 0 }}>
          {ICON_PIN_WHITE}<span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{rightLabel}</span>
        </div>
        <div style={{ flex: 1, background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 20, opacity: dx < -10 ? 1 : 0 }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{leftLabel}</span>{ICON_TRASH_WHITE}
        </div>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        style={{ transform: `translateX(${dx}px)`, transition: dragRef.current?.dragging ? 'none' : 'transform 0.2s ease', touchAction: 'pan-y' }}>
        {children}
      </div>
    </div>
  )
}

export default function ChatScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadedList, setLoadedList] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuConv, setMenuConv] = useState<Conversation | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
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
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [msgMenu, setMsgMenu] = useState<ChatMessage | null>(null)
  const [msgMenuPos, setMsgMenuPos] = useState({ x: 0, y: 0 })
  const [confirm, setConfirm] = useState<{ text: React.ReactNode; confirmLabel: string; danger: boolean; onConfirm: () => void } | null>(null)
  const [contacts, setContacts] = useState<RouteMember[]>([])
  const activeKeyRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const groupAvatarInputRef = useRef<HTMLInputElement>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [attachMenuPos, setAttachMenuPos] = useState({ left: 8, bottom: 60 })
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState<{ kind: 'voice' | 'video_note' } | null>(null)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [videoPreviewStream, setVideoPreviewStream] = useState<MediaStream | null>(null)
  const [videoFacing, setVideoFacing] = useState<'user' | 'environment'>('user')
  const [flippingCamera, setFlippingCamera] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingMinimized, setRecordingMinimized] = useState(false)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  // Stable ref callback: an inline arrow function would get a new identity every
  // render (the recording timer re-renders every 250ms), making React detach and
  // reattach the ref — and reassign srcObject — constantly, which flashes the preview.
  const setVideoPreviewEl = useCallback((el: HTMLVideoElement | null) => {
    videoPreviewRef.current = el
    if (el && el.srcObject !== videoPreviewStream) el.srcObject = videoPreviewStream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPreviewStream])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordStreamRef = useRef<MediaStream | null>(null)
  const recordCanvasStreamRef = useRef<MediaStream | null>(null)
  const drawFrameRafRef = useRef<number | null>(null)
  const recordElapsedRef = useRef(0)
  const recordLastTickRef = useRef(0)
  const recordingPausedRef = useRef(false)
  const recordTimerRef = useRef<number | null>(null)
  const tempIdRef = useRef(0)
  const pendingFilesRef = useRef<Map<number, {
    file: File | Blob
    kind: 'image' | 'file' | 'voice' | 'video_note'
    opts?: { caption?: string; duration?: number; filename?: string }
  }>>(new Map())
  const longPressTimerRef = useRef<number | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressMsgClickRef = useRef(false)

  const loadConversations = () => {
    getChatConversations().then(r => { setConversations(r.data); setLoadedList(true) }).catch(() => setLoadedList(true))
  }

  useEffect(() => {
    loadConversations()
    const t = setInterval(loadConversations, 8000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { activeKeyRef.current = active?.key ?? null }, [active])

  // Route mates reachable for a fresh DM even before any messages exist between us.
  const routeKeys = conversations.filter(c => c.type === 'route').map(c => c.key).sort().join(',')
  useEffect(() => {
    if (!routeKeys) { setContacts([]); return }
    const routeNumbers = routeKeys.split(',').map(k => k.split(':')[1])
    Promise.all(routeNumbers.map(rn => getChatRouteMembers(rn).then(r => r.data as RouteMember[]).catch(() => [] as RouteMember[])))
      .then(results => {
        const merged = new Map<number, RouteMember>()
        results.flat().forEach(m => merged.set(m.id, m))
        setContacts(Array.from(merged.values()))
      })
  }, [routeKeys])

  const loadMessages = (key: string, opts?: { forceScroll?: boolean }) => {
    const el = listRef.current
    const wasNearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
    getChatMessages(key).then(r => {
      if (activeKeyRef.current !== key) return
      setMessages(prev => [...r.data, ...prev.filter(m => m.pending || m.failed)])
      if (opts?.forceScroll || wasNearBottom) {
        setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 30)
      }
    }).catch(() => {})
  }

  useEffect(() => {
    if (!active) return
    loadMessages(active.key, { forceScroll: true })
    const t = setInterval(() => loadMessages(active.key), 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key])

  // Stop any in-progress recording when leaving the thread or unmounting.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null
        mediaRecorderRef.current.stop()
      }
      recordStreamRef.current?.getTracks().forEach(t => t.stop())
      recordCanvasStreamRef.current?.getTracks().forEach(t => t.stop())
      if (recordTimerRef.current != null) clearInterval(recordTimerRef.current)
      if (drawFrameRafRef.current != null) cancelAnimationFrame(drawFrameRafRef.current)
    }
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
    setTitleEditing(false)
    setMembersLoading(true)
    Promise.all([
      getChatRouteMembers(routeNumber).then(r => setMembers(r.data)).catch(() => setMembers([])),
      getChatGroup(active.key).then(r => setGroupInfo(r.data)).catch(() => setGroupInfo(null)),
    ]).finally(() => setMembersLoading(false))
  }

  // Keep online/last-seen fresh while the group-info screen is open.
  useEffect(() => {
    if (!(active && showMembers && active.type === 'route')) return
    const routeNumber = active.key.split(':')[1]
    const t = setInterval(() => {
      getChatRouteMembers(routeNumber).then(r => setMembers(r.data)).catch(() => {})
    }, 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key, showMembers])

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

  const startTitleEdit = () => {
    if (!groupInfo?.is_admin || !active) return
    setTitleDraft(groupInfo.title || active.title)
    setTitleEditing(true)
  }

  const saveGroupTitle = async () => {
    const value = titleDraft.trim()
    if (!value || !active) { setTitleEditing(false); return }
    setTitleSaving(true)
    try {
      const res = await updateChatGroupTitle(active.key, value)
      setGroupInfo(res.data)
      setActive(prev => prev ? { ...prev, title: res.data.title || prev.title } : prev)
      loadConversations()
      setTitleEditing(false)
    } catch {}
    finally { setTitleSaving(false) }
  }

  const toggleMemberAdmin = async (m: RouteMember) => {
    if (!active) return
    try {
      if (m.is_admin) await removeChatGroupAdmin(active.key, m.id)
      else await addChatGroupAdmin(active.key, m.id)
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, is_admin: !x.is_admin } : x))
    } catch {}
  }

  const removeMember = (m: RouteMember) => {
    if (!active) return
    const key = active.key
    askConfirm(<>Удалить {nameHighlight(m.full_name)} из группы?</>, 'Удалить', true, async () => {
      try {
        await removeChatGroupMember(key, m.id)
        setMembers(prev => prev.filter(x => x.id !== m.id))
      } catch {}
    })
  }

  const toggleSearch = () => {
    setSearchOpen(o => {
      const next = !o
      if (!next) setSearch('')
      return next
    })
    setTimeout(() => searchInputRef.current?.focus(), 30)
  }

  const askConfirm = (text: React.ReactNode, confirmLabel: string, danger: boolean, onConfirm: () => void) => {
    setConfirm({ text, confirmLabel, danger, onConfirm })
  }

  const nameHighlight = (name: string) => <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{name}</span>

  const togglePin = (c: Conversation) => {
    setChatConversationState(c.key, { pinned: !c.pinned }).then(loadConversations).catch(() => {})
    setMenuConv(null)
  }

  const deleteConversation = (c: Conversation) => {
    setMenuConv(null)
    askConfirm(<>Удалить чат «{nameHighlight(c.title)}»? Он исчезнет из списка, пока не придёт новое сообщение.</>, 'Удалить', true, () => {
      setChatConversationState(c.key, { hidden: true }).then(loadConversations).catch(() => {})
      setConversations(prev => prev.filter(x => x.key !== c.key))
    })
  }

  const clearConversation = (c: Conversation) => {
    setMenuConv(null)
    askConfirm(<>Очистить историю сообщений в чате «{nameHighlight(c.title)}»? Это затронет только ваш экран.</>, 'Очистить', false, () => {
      clearChatConversation(c.key).then(() => {
        loadConversations()
        if (activeKeyRef.current === c.key) loadMessages(c.key, { forceScroll: true })
      }).catch(() => {})
      setConversations(prev => prev.map(x => x.key === c.key ? { ...x, last_message: undefined, last_message_at: undefined, unread: 0 } : x))
    })
  }

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 30)
  }

  const makeOptimisticMessage = (overrides: Partial<ChatMessage>): ChatMessage => {
    const me = useAuthStore.getState()
    tempIdRef.current -= 1
    return {
      id: tempIdRef.current,
      conversation_key: active?.key ?? '',
      sender_id: me.userId ?? 0,
      sender_name: me.fullName ?? '',
      sender_role: me.role ?? '',
      text: '',
      created_at: new Date().toISOString(),
      mine: true,
      edited: false,
      deleted: false,
      read: false,
      pending: true,
      ...overrides,
    }
  }

  const send = async () => {
    const value = text.trim()
    if (!value || !active) return
    if (editingId != null) {
      const id = editingId
      setText('')
      setEditingId(null)
      setSending(true)
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
    const optimistic = makeOptimisticMessage({ text: value })
    setMessages(prev => [...prev, optimistic])
    scrollToBottom()
    try {
      const res = await postChatMessage(active.key, value)
      setMessages(prev => prev.map(m => m.id === optimistic.id ? res.data : m))
      loadConversations()
    } catch {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, pending: false, failed: true } : m))
    }
  }

  const sendAttachment = async (
    file: File | Blob,
    kind: 'image' | 'file' | 'voice' | 'video_note',
    opts?: { caption?: string; duration?: number; filename?: string }
  ) => {
    if (!active) return
    const localUrl = URL.createObjectURL(file)
    const optimistic = makeOptimisticMessage({
      text: opts?.caption ?? '',
      attachment_url: localUrl,
      attachment_type: kind,
      attachment_name: opts?.filename ?? (file instanceof File ? file.name : null),
      attachment_size: kind === 'file' ? file.size : null,
      attachment_duration: opts?.duration ?? null,
      localUrl,
    })
    pendingFilesRef.current.set(optimistic.id, { file, kind, opts })
    setMessages(prev => [...prev, optimistic])
    scrollToBottom()
    try {
      const res = await uploadChatAttachment(active.key, file, kind, opts)
      setMessages(prev => prev.map(m => m.id === optimistic.id ? res.data : m))
      loadConversations()
      URL.revokeObjectURL(localUrl)
      pendingFilesRef.current.delete(optimistic.id)
    } catch {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, pending: false, failed: true } : m))
    }
  }

  const retryMessage = (m: ChatMessage) => {
    if (!active || !m.failed) return
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, failed: false, pending: true } : x))
    if (m.attachment_type) {
      const payload = pendingFilesRef.current.get(m.id)
      if (!payload) {
        setMessages(prev => prev.map(x => x.id === m.id ? { ...x, failed: true, pending: false } : x))
        return
      }
      uploadChatAttachment(active.key, payload.file, payload.kind, payload.opts)
        .then(res => {
          setMessages(prev => prev.map(x => x.id === m.id ? res.data : x))
          loadConversations()
          if (m.localUrl) URL.revokeObjectURL(m.localUrl)
          pendingFilesRef.current.delete(m.id)
        })
        .catch(() => setMessages(prev => prev.map(x => x.id === m.id ? { ...x, pending: false, failed: true } : x)))
    } else {
      postChatMessage(active.key, m.text)
        .then(res => {
          setMessages(prev => prev.map(x => x.id === m.id ? res.data : x))
          loadConversations()
        })
        .catch(() => setMessages(prev => prev.map(x => x.id === m.id ? { ...x, pending: false, failed: true } : x)))
    }
  }

  const removeFailedMessage = (m: ChatMessage) => {
    setMessages(prev => prev.filter(x => x.id !== m.id))
    if (m.localUrl) URL.revokeObjectURL(m.localUrl)
    pendingFilesRef.current.delete(m.id)
  }

  // Long-press (touch/mouse-hold) or right-click opens the edit/delete menu —
  // matching Telegram/WhatsApp, and avoiding the menu popping up unexpectedly
  // from a plain tap that was meant to play/open the message's attachment.
  const openMsgMenuAt = (m: ChatMessage, target: HTMLElement) => {
    if (m.deleted || m.pending) return
    if (m.failed) { retryMessage(m); return }
    const r = target.getBoundingClientRect()
    setMsgMenuPos({ x: m.mine ? r.right : r.left, y: r.bottom })
    setMsgMenu(m)
  }

  const msgLongPressHandlers = (m: ChatMessage) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (m.deleted || m.pending) return
      longPressStartRef.current = { x: e.clientX, y: e.clientY }
      const target = e.currentTarget
      if (longPressTimerRef.current != null) clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null
        suppressMsgClickRef.current = true
        openMsgMenuAt(m, target)
      }, LONG_PRESS_MS)
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const start = longPressStartRef.current
      if (!start || longPressTimerRef.current == null) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    },
    onPointerUp: () => {
      if (longPressTimerRef.current != null) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    },
    onPointerCancel: () => {
      if (longPressTimerRef.current != null) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    },
    onPointerLeave: () => {
      if (longPressTimerRef.current != null) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    },
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault()
      openMsgMenuAt(m, e.currentTarget)
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (suppressMsgClickRef.current) {
        suppressMsgClickRef.current = false
        e.stopPropagation()
        e.preventDefault()
      }
    },
    onClick: () => {
      if (m.failed) retryMessage(m)
    },
  })

  const onImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setAttachMenuOpen(false)
    if (!file) return
    const caption = text.trim()
    setText('')
    sendAttachment(file, 'image', { caption })
  }

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setAttachMenuOpen(false)
    if (!file) return
    const caption = text.trim()
    setText('')
    sendAttachment(file, 'file', { caption, filename: file.name })
  }

  const pickRecorderMime = (kind: 'voice' | 'video_note') => {
    const candidates = kind === 'voice'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      : ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    return candidates.find(c => (window as any).MediaRecorder?.isTypeSupported?.(c)) || ''
  }

  const startRecording = async (kind: 'voice' | 'video_note') => {
    if (recording) return
    try {
      setVideoFacing('user')
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'voice'
          ? { audio: true }
          : { audio: true, video: { width: { ideal: 320 }, height: { ideal: 320 }, facingMode: 'user' } }
      )
      recordStreamRef.current = stream

      // For video notes, record from a <canvas> fed by the preview <video>
      // rather than the raw camera stream directly. A camera flip mid-recording
      // then just swaps what the canvas draws from — the MediaRecorder's own
      // stream (and thus its state/pause/stop) never changes, which live
      // track-swapping on the camera stream turned out not to support reliably.
      let recorderStream: MediaStream = stream
      if (kind === 'video_note') {
        setVideoPreviewStream(stream)
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 320
        const ctx = canvas.getContext('2d')
        const drawFrame = () => {
          const v = videoPreviewRef.current
          if (v && ctx && v.readyState >= 2 && v.videoWidth > 0) {
            const size = Math.min(v.videoWidth, v.videoHeight)
            ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, canvas.width, canvas.height)
          }
          drawFrameRafRef.current = requestAnimationFrame(drawFrame)
        }
        drawFrameRafRef.current = requestAnimationFrame(drawFrame)
        const canvasStream = canvas.captureStream(30)
        stream.getAudioTracks().forEach(t => canvasStream.addTrack(t))
        recordCanvasStreamRef.current = canvasStream
        recorderStream = canvasStream
      }

      const mimeType = pickRecorderMime(kind)
      const recorder = mimeType ? new MediaRecorder(recorderStream, { mimeType }) : new MediaRecorder(recorderStream)
      recordedChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      recorder.start()
      mediaRecorderRef.current = recorder
      recordElapsedRef.current = 0
      recordLastTickRef.current = Date.now()
      recordingPausedRef.current = false
      setRecordingPaused(false)
      setRecordingMinimized(false)
      setRecordSeconds(0)
      setRecording({ kind })
      recordTimerRef.current = window.setInterval(() => {
        const now = Date.now()
        if (!recordingPausedRef.current) recordElapsedRef.current += now - recordLastTickRef.current
        recordLastTickRef.current = now
        setRecordSeconds(Math.round(recordElapsedRef.current / 1000))
      }, 250)
    } catch {
      setRecording(null)
    }
  }

  const togglePauseRecording = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      recordingPausedRef.current = true
      setRecordingPaused(true)
    } else if (recorder.state === 'paused') {
      recordLastTickRef.current = Date.now()
      recorder.resume()
      recordingPausedRef.current = false
      setRecordingPaused(false)
    }
  }

  const minimizeRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') togglePauseRecording()
    setRecordingMinimized(true)
  }

  const flipCamera = async () => {
    if (!recording || recording.kind !== 'video_note' || flippingCamera) return
    const oldStream = recordStreamRef.current
    if (!oldStream) return
    const nextFacing = videoFacing === 'user' ? 'environment' : 'user'
    setFlippingCamera(true)
    try {
      // The recorder consumes a <canvas> stream (see startRecording), not the
      // camera stream directly, so flipping only needs to swap what the draw
      // loop reads from — the recorder/audio track are untouched and keep running.
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 320 }, facingMode: nextFacing },
      })
      const newVideoTrack = newVideoStream.getVideoTracks()[0]
      if (!newVideoTrack) return

      oldStream.getVideoTracks().forEach(t => t.stop())
      const newPreviewStream = new MediaStream([newVideoTrack, ...oldStream.getAudioTracks()])
      recordStreamRef.current = newPreviewStream
      setVideoPreviewStream(newPreviewStream)
      setVideoFacing(nextFacing)
    } catch {
      // camera unavailable (e.g. device has no second camera) — keep current one
    } finally {
      setFlippingCamera(false)
    }
  }

  const stopRecording = (send: boolean) => {
    const recorder = mediaRecorderRef.current
    const kind = recording?.kind
    const duration = Math.round(recordElapsedRef.current / 1000)
    if (recordTimerRef.current != null) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
    if (drawFrameRafRef.current != null) { cancelAnimationFrame(drawFrameRafRef.current); drawFrameRafRef.current = null }
    recordCanvasStreamRef.current?.getTracks().forEach(t => t.stop())
    recordCanvasStreamRef.current = null
    recordStreamRef.current?.getTracks().forEach(t => t.stop())
    recordStreamRef.current = null
    setVideoPreviewStream(null)
    setRecording(null)
    setRecordSeconds(0)
    setRecordingPaused(false)
    setRecordingMinimized(false)
    if (!recorder || !kind) return
    if (!send) {
      recorder.onstop = null
      recorder.stop()
      return
    }
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || (kind === 'voice' ? 'audio/webm' : 'video/webm') })
      recordedChunksRef.current = []
      if (blob.size > 0) sendAttachment(blob, kind, { duration })
    }
    recorder.stop()
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

  const removeMessage = (m: ChatMessage, forEveryone: boolean) => {
    setMsgMenu(null)
    askConfirm(forEveryone ? 'Удалить сообщение у всех?' : 'Удалить сообщение у себя?', 'Удалить', forEveryone, async () => {
      try {
        await deleteChatMessage(m.id, forEveryone)
        if (forEveryone) {
          setMessages(prev => prev.map(x => x.id === m.id ? { ...x, deleted: true, text: '' } : x))
          loadConversations()
        } else {
          setMessages(prev => prev.filter(x => x.id !== m.id))
        }
      } catch {}
    })
  }

  const confirmModal = confirm && (
    <div onClick={() => setConfirm(null)}
      className="map-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 16, padding: '20px 20px 16px', width: '100%', maxWidth: 300, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, lineHeight: 1.4 }}>{confirm.text}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConfirm(null)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid var(--border)', background: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Отмена
          </button>
          <button onClick={() => { confirm.onConfirm(); setConfirm(null) }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: confirm.danger ? '#FF3B30' : 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Group info screen (own full screen, Telegram-style) ─────────────
  if (active && showMembers) {
    const displayTitle = groupInfo?.title || active.title
    return (
      <div className="map-page-root" style={{ display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setShowMembers(false)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16, flex: 1 }}>Информация о группе</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#F7F7F7' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 20px', background: 'white', borderBottom: '8px solid #F0F0F0' }}>
            <div onClick={groupInfo?.is_admin && !avatarUploading ? pickGroupAvatar : undefined}
              style={{ position: 'relative', cursor: groupInfo?.is_admin && !avatarUploading ? 'pointer' : 'default' }}>
              <Avatar url={groupInfo?.avatar_url} fallback={ICON_ROUTE} size={92} />
              {groupInfo?.is_admin && (
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderRadius: '50%', background: 'var(--orange)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarUploading ? <LogoLoader size={16} /> : ICON_CAMERA}
                </div>
              )}
            </div>
            {groupInfo?.is_admin && (
              <input ref={groupAvatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onGroupAvatarChange} />
            )}

            {titleEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 280 }}>
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGroupTitle(); if (e.key === 'Escape') setTitleEditing(false) }}
                  autoFocus
                  style={{ flex: 1, fontSize: 17, fontWeight: 800, textAlign: 'center', border: '1.5px solid var(--border)', borderRadius: 10, padding: '6px 10px' }}
                />
                <button onClick={saveGroupTitle} disabled={titleSaving || !titleDraft.trim()}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            ) : (
              <div onClick={startTitleEdit} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: groupInfo?.is_admin ? 'pointer' : 'default' }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{displayTitle}</span>
                {groupInfo?.is_admin && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                )}
              </div>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {groupInfo?.is_admin ? 'Аватар и название группы видят все участники' : 'Изменить может только администратор'}
            </span>
          </div>

          <div style={{ padding: '14px 16px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Участники{members.length > 0 ? ` (${members.length})` : ''}
          </div>

          {membersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><LogoLoader size={40} /></div>
          ) : members.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '24px 20px', background: 'white' }}>
              Других участников на маршруте пока нет
            </div>
          ) : (
            <div style={{ background: 'white' }}>
              {members.map(m => (
                <div key={m.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid #F5F5F5' }}>
                  <div onClick={m.is_me ? undefined : () => openMemberDm(m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: m.is_me ? 'default' : 'pointer' }}>
                    <Avatar url={m.avatar_url} fallback={ICON_DM} size={40} online={m.online} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.full_name}{m.is_me ? ' (Вы)' : ''}
                        </span>
                        {m.is_owner ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#FFF3EE', borderRadius: 8, padding: '2px 7px', flexShrink: 0 }}>
                            {ICON_SHIELD}<span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)' }}>Владелец</span>
                          </span>
                        ) : m.is_admin && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#FFF3EE', borderRadius: 8, padding: '2px 7px', flexShrink: 0 }}>
                            {ICON_SHIELD}<span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)' }}>Админ</span>
                          </span>
                        )}
                      </span>
                      {(() => {
                        const label = presenceLabel(m.online, m.last_seen_at)
                        return label ? <span style={{ fontSize: 11.5, color: m.online ? '#4CAF50' : 'var(--text-muted)' }}>{label}</span> : null
                      })()}
                    </div>
                  </div>
                  {groupInfo?.is_admin && !m.is_owner && !m.is_me ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {groupInfo?.is_owner && (
                        <button onClick={() => toggleMemberAdmin(m)}
                          style={{ background: m.is_admin ? '#F5F5F5' : '#FFF3EE', border: 'none', borderRadius: 20, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: m.is_admin ? '#999' : 'var(--orange)', cursor: 'pointer' }}>
                          {m.is_admin ? 'Снять права' : 'Сделать админом'}
                        </button>
                      )}
                      <button onClick={() => removeMember(m)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : !m.is_me ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
        {confirmModal}
      </div>
    )
  }

  // ── Thread view ──────────────────────────────────────────────────
  if (active) {
    const activePresence = active.type === 'dm' ? (conversations.find(c => c.key === active.key) ?? active) : null
    const activePresenceText = activePresence ? presenceLabel(!!activePresence.online, activePresence.last_seen_at) : null
    return (
      <div className="map-page-root" style={{ display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--orange)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setActive(null); setEditingId(null); setText('') }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <Avatar url={active.avatar_url} fallback={active.type === 'route' ? ICON_ROUTE : ICON_DM} size={34} bg="rgba(255,255,255,0.2)" online={activePresence ? !!activePresence.online : false} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.title}</div>
            {activePresenceText && (
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activePresenceText}</div>
            )}
          </div>
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
                    {!m.deleted && m.attachment_type === 'video_note' ? (
                      <div
                        {...msgLongPressHandlers(m)}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start', touchAction: 'pan-y' }}>
                        <VideoNoteMessagePlayer src={resolveAssetUrl(m.attachment_url!)} pending={m.pending} failed={m.failed} />
                        {m.text && (
                          <div style={{
                            marginTop: 6, padding: '9px 13px', borderRadius: 16, fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word',
                            background: m.mine ? 'var(--orange)' : 'white', color: m.mine ? 'white' : 'var(--text-primary)',
                            boxShadow: m.mine ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                          }}>
                            {m.text}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        {...(m.deleted ? {} : msgLongPressHandlers(m))}
                        style={{
                          padding: m.attachment_type === 'image' && !m.deleted ? 4 : '9px 13px', borderRadius: 16,
                          background: m.deleted ? (m.mine ? 'rgba(255,255,255,0.25)' : '#EFEFEF') : (m.mine ? 'var(--orange)' : 'white'),
                          color: m.deleted ? (m.mine ? 'rgba(255,255,255,0.8)' : '#999') : (m.mine ? 'white' : 'var(--text-primary)'),
                          boxShadow: (m.mine || m.deleted) ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                          fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word',
                          fontStyle: m.deleted ? 'italic' : 'normal',
                          cursor: m.deleted ? 'default' : 'pointer',
                          touchAction: 'pan-y',
                        }}>
                        {m.deleted ? 'Сообщение удалено' : (
                          <>
                            {m.attachment_type === 'image' && (
                              <div style={{ position: 'relative', marginBottom: m.text ? 6 : 0 }}>
                                <img src={resolveAssetUrl(m.attachment_url!)}
                                  style={{ display: 'block', maxWidth: 220, maxHeight: 280, borderRadius: 12 }} />
                                <MediaStatusOverlay pending={m.pending} failed={m.failed} />
                              </div>
                            )}
                            {m.attachment_type === 'file' && (
                              <div onClick={e => { if (!m.pending && !m.failed) e.stopPropagation() }}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default', marginBottom: m.text ? 8 : 0, minWidth: 160 }}>
                                <div style={{
                                  position: 'relative', width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                  background: m.mine ? 'rgba(255,255,255,0.2)' : '#FFF3EE',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {iconFile(m.mine ? 'white' : 'var(--orange)')}
                                  <MediaStatusOverlay pending={m.pending} failed={m.failed} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.attachment_name || 'Файл'}
                                  </div>
                                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                                    {m.pending ? 'Отправка...' : m.failed ? 'Не отправлено · нажмите, чтобы повторить' : (m.attachment_size != null ? formatBytes(m.attachment_size) : null)}
                                  </div>
                                </div>
                                {!m.pending && !m.failed && (
                                  <a href={resolveAssetUrl(m.attachment_url!)} target="_blank" rel="noreferrer" download={m.attachment_name || true}
                                    onClick={e => e.stopPropagation()} style={{ flexShrink: 0, display: 'flex' }}>
                                    {iconDownload(m.mine ? 'white' : '#999')}
                                  </a>
                                )}
                              </div>
                            )}
                            {m.attachment_type === 'voice' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: m.text ? 6 : 0 }}>
                                {m.pending || m.failed ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.mine ? 'rgba(255,255,255,0.22)' : '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      {iconPlay(m.mine ? 'white' : 'var(--orange)')}
                                    </div>
                                    <span style={{ fontSize: 12, opacity: 0.85 }}>{m.pending ? 'Отправка...' : 'Не отправлено'}</span>
                                    {m.pending ? <PendingSpinner color={m.mine ? 'white' : '#AAA'} /> : <FailedBadge />}
                                  </div>
                                ) : (
                                  <VoiceMessagePlayer src={resolveAssetUrl(m.attachment_url!)} mine={m.mine} knownDuration={m.attachment_duration} />
                                )}
                              </div>
                            )}
                            {m.text && (
                              m.attachment_type === 'image'
                                ? <div style={{ padding: '0 5px 3px' }}>{m.text}</div>
                                : m.text
                            )}
                          </>
                        )}
                      </div>
                    )}
                    <span style={{ fontSize: 10, color: '#AAA', marginTop: 2, marginRight: m.mine ? 4 : 0, marginLeft: m.mine ? 0 : 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {m.failed ? 'не отправлено' : messageTime(m.created_at)}{m.edited && !m.deleted && !m.pending && !m.failed ? ' · изменено' : ''}
                      {m.mine && !m.deleted && (
                        m.pending ? <PendingSpinner /> : m.failed ? (
                          <>
                            <span onClick={e => { e.stopPropagation(); retryMessage(m) }} style={{ cursor: 'pointer', display: 'flex' }}><FailedBadge /></span>
                            <span onClick={e => { e.stopPropagation(); removeFailedMessage(m) }} style={{ cursor: 'pointer', color: '#FF3B30', fontWeight: 700, padding: '0 2px' }}>✕</span>
                          </>
                        ) : <ReadTicks read={m.read} />
                      )}
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
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageSelected} />
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileSelected} />

          {recording?.kind === 'voice' ? (
            <div style={{ padding: '10px 12px', paddingBottom: 'calc(10px + var(--nav-safe))', display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => stopRecording(false)}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF3B30', flexShrink: 0, animation: 'chat-rec-blink 1s infinite' }} />
                <span style={{ fontSize: 14, color: '#666', fontVariantNumeric: 'tabular-nums' }}>
                  {String(Math.floor(recordSeconds / 60)).padStart(1, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 13, color: '#AAA' }}>Голосовое</span>
              </div>
              <button onClick={() => stopRecording(true)}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          ) : recording?.kind === 'video_note' && recordingMinimized ? (
            <div style={{ padding: '10px 12px', paddingBottom: 'calc(10px + var(--nav-safe))', display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => stopRecording(false)}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              <div onClick={() => setRecordingMinimized(false)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--orange-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Видеосообщение{recordingPaused ? ' · на паузе' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {String(Math.floor(recordSeconds / 60)).padStart(1, '0')}:{String(recordSeconds % 60).padStart(2, '0')} · нажмите, чтобы продолжить
                  </div>
                </div>
              </div>
              <button onClick={() => stopRecording(true)}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          ) : (
            <div style={{ padding: '10px 12px', paddingBottom: 'calc(10px + var(--nav-safe))', display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
              {editingId == null && (
                <button
                  onClick={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setAttachMenuPos({ left: r.left, bottom: window.innerHeight - r.top + 6 })
                    setAttachMenuOpen(v => !v)
                  }}
                  onMouseDown={e => e.preventDefault()}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#999' }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
              )}
              {attachMenuOpen && (
                <div onClick={() => setAttachMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }}>
                  <div onClick={e => e.stopPropagation()} className="chat-ctx-menu"
                    style={{ position: 'fixed', bottom: attachMenuPos.bottom, left: attachMenuPos.left, width: 180, background: 'white', borderRadius: 12, boxShadow: '0 6px 28px rgba(0,0,0,0.2)', border: '1px solid #EEE', overflow: 'hidden' }}>
                    <div onClick={() => imageInputRef.current?.click()}
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid #F5F5F5' }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Фото</span>
                    </div>
                    <div onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Файл</span>
                    </div>
                  </div>
                </div>
              )}
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } if (e.key === 'Escape' && editingId != null) cancelEdit() }}
                placeholder="Сообщение..."
                rows={1}
                style={{ flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 20, padding: '10px 16px', fontSize: 14, fontFamily: 'inherit', maxHeight: 100 }}
              />
              {text.trim() || editingId != null ? (
                <button onClick={send} disabled={!text.trim() || sending}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: text.trim() ? 'var(--orange)' : '#E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
                  {editingId != null
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
                  }
                </button>
              ) : (
                <>
                  <button onClick={() => startRecording('video_note')} onMouseDown={e => e.preventDefault()}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  </button>
                  <button onClick={() => startRecording('voice')} onMouseDown={e => e.preventDefault()}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {recording?.kind === 'video_note' && !recordingMinimized && createPortal(
          <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(12,12,14,0.6)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <button onClick={minimizeRecording}
              style={{
                position: 'absolute', left: 16, top: 'calc(16px + env(safe-area-inset-top, 0px))',
                width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(70,70,74,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>

            <div style={{ position: 'relative', width: 260, height: 260 }}>
              <video ref={setVideoPreviewEl} autoPlay muted playsInline
                style={{ width: 260, height: 260, borderRadius: '50%', objectFit: 'cover', display: 'block', background: '#000', transform: videoFacing === 'user' ? 'scaleX(-1)' : 'none' }} />
              {flippingCamera && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PendingSpinner size={30} color="white" />
                </div>
              )}
              <button onClick={togglePauseRecording}
                style={{
                  position: 'absolute', right: -6, bottom: 8, transform: 'translateX(100%)',
                  width: 48, height: 48, borderRadius: '50%', border: 'none', background: 'rgba(70,70,74,0.75)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                {recordingPaused
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M6 4l14 8-14 8z" /></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>
                }
              </button>
            </div>

            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
              padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <button onClick={flipCamera} disabled={flippingCamera}
                style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(70,70,74,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                </svg>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(70,70,74,0.75)', borderRadius: 26, padding: '12px 18px', minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF3B30', flexShrink: 0, animation: recordingPaused ? 'none' : 'chat-rec-blink 1s infinite' }} />
                  <span style={{ color: 'white', fontSize: 15, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {String(Math.floor(recordSeconds / 60)).padStart(1, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
                  </span>
                  <button onClick={() => stopRecording(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--orange-light)', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
                    Отмена
                  </button>
                </div>
                <button onClick={() => stopRecording(true)}
                  style={{
                    width: 56, height: 56, borderRadius: '50%', border: 'none', background: 'var(--orange)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                    boxShadow: '0 4px 16px rgba(255,102,0,0.5)',
                  }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {msgMenu && createPortal(
          <div onClick={() => setMsgMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
            <div onClick={e => e.stopPropagation()}
              className="chat-ctx-menu"
              style={{
                position: 'fixed',
                top: Math.min(msgMenuPos.y + 4, window.innerHeight - 160),
                left: msgMenu.mine
                  ? Math.min(Math.max(msgMenuPos.x - 200, 8), window.innerWidth - 208)
                  : Math.min(Math.max(msgMenuPos.x, 8), window.innerWidth - 208),
                width: 200, background: 'white', borderRadius: 12,
                boxShadow: '0 6px 28px rgba(0,0,0,0.2)', border: '1px solid #EEE', overflow: 'hidden',
              }}>
              {msgMenu.mine && (
                <div onClick={() => startEdit(msgMenu)}
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid #F5F5F5' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Редактировать</span>
                </div>
              )}
              <div onClick={() => removeMessage(msgMenu, false)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: msgMenu.mine ? '1px solid #F5F5F5' : 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Удалить у меня</span>
              </div>
              {msgMenu.mine && (
                <div onClick={() => removeMessage(msgMenu, true)}
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#FF3B30' }}>Удалить у всех</span>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
        {confirmModal}
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

  const existingDmKeys = new Set(conversations.filter(c => c.type === 'dm').map(c => c.key))
  const searchContacts = q
    ? contacts.filter(m => !m.is_me && !existingDmKeys.has(m.dm_key) && m.full_name.toLowerCase().includes(q))
    : []

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
      ) : filteredConversations.length === 0 && searchContacts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '40px 20px' }}>
          Ничего не найдено
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {filteredConversations.map(c => (
            <SwipeableChatRow key={c.key}
              rightLabel={c.pinned ? 'Открепить' : 'Закрепить'}
              leftLabel={c.type === 'route' ? 'Очистить' : 'Удалить'}
              onSwipeRight={() => togglePin(c)}
              onSwipeLeft={() => (c.type === 'route' ? clearConversation(c) : deleteConversation(c))}>
              <div onClick={() => openConversation(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 8px 13px 16px', cursor: 'pointer', borderBottom: '1px solid #F0F0F0', background: c.pinned ? '#FFFBF7' : 'white' }}>
                <Avatar url={c.avatar_url} fallback={c.type === 'route' ? ICON_ROUTE : ICON_DM} size={44} online={c.type === 'dm' && !!c.online} />
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
                <button onClick={e => {
                  e.stopPropagation()
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenuPos({ x: r.right, y: r.bottom })
                  setMenuConv(c)
                }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 6px', flexShrink: 0, color: '#BBB', fontSize: 18, lineHeight: 1 }}>
                  ⋮
                </button>
              </div>
            </SwipeableChatRow>
          ))}
          {searchContacts.length > 0 && (
            <>
              <div style={{ padding: '14px 16px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Написать сообщение
              </div>
              {searchContacts.map(m => (
                <div key={m.dm_key}
                  onClick={() => openConversation({ key: m.dm_key, type: 'dm', title: m.full_name, avatar_url: m.avatar_url, unread: 0, online: m.online, last_seen_at: m.last_seen_at })}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 8px 13px 16px', cursor: 'pointer', borderBottom: '1px solid #F0F0F0' }}>
                  <Avatar url={m.avatar_url} fallback={ICON_DM} size={44} online={m.online} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlight(m.full_name, q)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Написать сообщение</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {menuConv && (
        <div onClick={() => setMenuConv(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }}>
          <div onClick={e => e.stopPropagation()}
            className="chat-ctx-menu"
            style={{
              position: 'fixed',
              top: Math.min(menuPos.y + 4, window.innerHeight - 116),
              left: Math.min(Math.max(menuPos.x - 200, 8), window.innerWidth - 208),
              width: 200, background: 'white', borderRadius: 12,
              boxShadow: '0 6px 28px rgba(0,0,0,0.2)', border: '1px solid #EEE', overflow: 'hidden',
            }}>
            <div onClick={() => togglePin(menuConv)}
              style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid #F5F5F5' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-2-3.5V7a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v6.5L5 17z"/></svg>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{menuConv.pinned ? 'Открепить' : 'Закрепить'}</span>
            </div>
            {menuConv.type === 'route' ? (
              <div onClick={() => clearConversation(menuConv)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Очистить чат</span>
              </div>
            ) : (
              <div onClick={() => deleteConversation(menuConv)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#FF3B30' }}>Удалить чат</span>
              </div>
            )}
          </div>
        </div>
      )}
      {confirmModal}
    </div>
  )
}
