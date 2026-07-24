import { Capacitor } from '@capacitor/core'
import { updateMe } from './api/client'

/** Регистрирует устройство на push (только в нативном приложении — в браузере
 * плагина нет и push не нужен). Токен сохраняем на сервере, чтобы бэкенд знал,
 * куда слать уведомления о новых сообщениях в чате.
 *
 * onChatNotificationTap вызывается и при тапе по уведомлению, когда приложение
 * уже открыто, и при холодном запуске приложение самим тапом — Capacitor сам
 * "запоминает" тап, которым было запущено приложение, и доставляет его этому
 * листенеру сразу после регистрации, так что отдельно обрабатывать cold start
 * не нужно. */
export async function initPushNotifications(onChatNotificationTap?: (conversationKey: string) => void) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return

    PushNotifications.addListener('registration', token => {
      updateMe({ push_token: token.value }).catch(() => {})
    })
    PushNotifications.addListener('registrationError', () => {})

    if (onChatNotificationTap) {
      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const key = action.notification.data?.conversation_key
        if (key) onChatNotificationTap(key)
      })
    }

    await PushNotifications.register()
  } catch {
    // Плагин недоступен (например, идёт сборка веб-версии) — просто не регистрируемся.
  }
}
