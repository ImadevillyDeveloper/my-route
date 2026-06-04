// Единый источник данных водителей — используется и предпринимателем и профилем водителя

export interface DriverEntry {
  id: string
  name: string
  vu: string
  plate: string
  route: string
  phone: string
}

export const DRIVER_MOCK: DriverEntry[] = [
  { id: '1', name: 'Черепанов Владимир Георгиевич', vu: '00 00 123456', plate: 'X264MP55', route: '212', phone: '8-913-673-79-65' },
  { id: '2', name: 'Калинин Сергей Александрович',  vu: '00 00 234567', plate: 'Y053EA55', route: '212', phone: '8-913-111-22-33' },
  { id: '3', name: 'Пивоваров Иван Алексеевич',     vu: '00 00 345678', plate: 'Y671HH55', route: '212', phone: '8-913-444-55-66' },
  { id: '4', name: 'Спринтер Алексей Сергеевич',    vu: '00 00 456789', plate: 'X264MP55', route: '212', phone: '8-913-777-88-99' },
]

/** Возвращает полный список водителей предпринимателя с учётом localStorage-правок и добавленных. */
export const getAllDrivers = (): DriverEntry[] => {
  const deletedIds: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('drivers_deleted') || '[]') } catch { return [] }
  })()

  const applyExtra = (d: DriverEntry): DriverEntry => {
    try {
      const saved = localStorage.getItem(`driver_extra_${d.id}`)
      const extra = saved ? JSON.parse(saved) : {}
      return { ...d, ...extra, id: d.id }
    } catch { return d }
  }

  const base = DRIVER_MOCK
    .filter(d => !deletedIds.includes(d.id))
    .map(applyExtra)

  const added: DriverEntry[] = (() => {
    try {
      const raw: any[] = JSON.parse(localStorage.getItem('drivers_added') || '[]')
      return raw
        .filter(d => !deletedIds.includes(String(d.id)))
        .map(d => applyExtra({
          id: String(d.id),
          name: d.name ?? '',
          vu: d.vu ?? '',
          plate: d.plate ?? '',
          route: d.route ?? '',
          phone: d.phone ?? '',
        }))
    } catch { return [] }
  })()

  return [...base, ...added]
}

/** Найти водителя по номеру ВУ. */
export const findDriverByVu = (vu: string): DriverEntry | undefined =>
  getAllDrivers().find(d => d.vu === vu)
