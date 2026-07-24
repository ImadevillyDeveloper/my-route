import { Capacitor } from '@capacitor/core'
import { getVehicleReminders } from './api/client'

type ReminderKey = 'kasko' | 'osago' | 'to'
interface ReminderConfig { enabled: boolean; daysBefore: number[] }
type RemindersState = Record<ReminderKey, ReminderConfig>

// Те же дефолты, что и в экране настроек напоминаний (VehicleReminders.tsx) —
// держим в синхроне вручную, это простая константа, не стоит городить общий модуль ради неё.
const DEFAULTS: RemindersState = {
  kasko: { enabled: true,  daysBefore: [30, 7] },
  osago: { enabled: true,  daysBefore: [14, 3] },
  to:    { enabled: false, daysBefore: [] },
}
const LABELS: Record<ReminderKey, string> = { kasko: 'КАСКО', osago: 'ОСАГО', to: 'Техосмотр' }
const TYPE_CODE: Record<ReminderKey, number> = { kasko: 1, osago: 2, to: 3 }

// Детерминированный id — так повторный вызов просто перезапишет те же
// уведомления вместо накопления дублей (мы всё равно чистим pending перед
// планированием заново, но id всё равно должен быть стабильным и уникальным).
const notifId = (vehicleId: number, key: ReminderKey, daysBefore: number) =>
  vehicleId * 1000 + TYPE_CODE[key] * 100 + daysBefore

/** Планирует локальные уведомления об истечении ОСАГО/КАСКО/ТО по всем ТС
 * предпринимателя — целиком на устройстве, без сервера (сроки известны заранее). */
export async function scheduleVehicleReminders() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    let perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'prompt') perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return

    const res = await getVehicleReminders()

    // Перепланируем с нуля каждый раз — проще, чем аккуратно диффать с уже
    // запланированными (сроки/настройки могли поменяться с прошлого раза).
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
    }

    const toSchedule: any[] = []
    for (const v of res.data) {
      let reminders: RemindersState = DEFAULTS
      if (v.reminders_json) {
        try { reminders = { ...DEFAULTS, ...JSON.parse(v.reminders_json) } } catch {}
      }
      const deadlines: Record<ReminderKey, string | null> = {
        kasko: v.kasko_end_date, osago: v.osago_end_date, to: v.to_next_date,
      }
      ;(['kasko', 'osago', 'to'] as ReminderKey[]).forEach(key => {
        const cfg = reminders[key]
        const deadlineIso = deadlines[key]
        if (!cfg?.enabled || !deadlineIso) return
        const deadline = new Date(deadlineIso)
        if (isNaN(deadline.getTime())) return
        cfg.daysBefore.forEach(days => {
          const fireAt = new Date(deadline)
          fireAt.setDate(fireAt.getDate() - days)
          fireAt.setHours(9, 0, 0, 0)
          if (fireAt.getTime() <= Date.now()) return
          toSchedule.push({
            id: notifId(v.vehicle_id, key, days),
            title: `${LABELS[key]} — истекает через ${days} дн.`,
            body: `ТС ${v.plate_number}: срок «${LABELS[key]}» истекает ${deadline.toLocaleDateString('ru-RU')}`,
            schedule: { at: fireAt },
          })
        })
      })
    }
    if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })
  } catch {
    // плагин недоступен или разрешение не дали — работаем без уведомлений
  }
}
