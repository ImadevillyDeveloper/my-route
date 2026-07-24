import { Capacitor } from '@capacitor/core'
import { updateMe } from './api/client'

/** Регистрирует устройство на push (только в нативном приложении — в браузере
 * плагина нет и push не нужен). Токен сохраняем на сервере, чтобы бэкенд знал,
 * куда слать уведомления о новых сообщениях в чате. */
export async function initPushNotifications() {
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

    await PushNotifications.register()
  } catch {
    // Плагин недоступен (например, идёт сборка веб-версии) — просто не регистрируемся.
  }
}
