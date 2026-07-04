import { useEffect, useState } from 'react'
import { getChatConversations } from '../../api/client'

export function useUnreadChatCount(intervalMs = 15000): number {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const load = () => {
      getChatConversations()
        .then(r => setUnread(r.data.reduce((sum: number, c: any) => sum + (c.unread || 0), 0)))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])

  return unread
}
