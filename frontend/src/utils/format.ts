const LATIN_TO_CYR: Record<string, string> = {
  'A':'А','B':'В','E':'Е','K':'К','M':'М','H':'Н','O':'О','P':'Р','C':'С','T':'Т','Y':'У','X':'Х'
}
const PLATE_LETTERS = 'АВЕКМНОРСТУХ'

// А 123 АА 55 (или А 123 АА 777 для трёхзначного региона)
export function formatPlate(raw: string): string {
  const conv = raw.toUpperCase().split('').map(c => LATIN_TO_CYR[c] ?? c).join('')
  const clean = conv.split('').filter(c => PLATE_LETTERS.includes(c) || /\d/.test(c)).join('').slice(0, 9)
  let out = ''
  for (let i = 0; i < clean.length; i++) {
    if (i === 1 || i === 4 || i === 6) out += ' '
    out += clean[i]
  }
  return out
}

// 00 00 123456
export function formatVU(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)} ${d.slice(2)}`
  return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}`
}

// +7 (xxx) xxx-xx-xx
export function formatPhone(val: string): string {
  let d = val.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('8')) d = '7' + d.slice(1)
  if (!d.startsWith('7')) d = '7' + d
  d = d.slice(0, 11)
  let f = '+' + d[0]
  if (d.length > 1) f += ' (' + d.slice(1, 4)
  if (d.length >= 4) f += ') ' + d.slice(4, 7)
  if (d.length >= 7) f += '-' + d.slice(7, 9)
  if (d.length >= 9) f += '-' + d.slice(9, 11)
  return f
}

// Заглавная первая буква каждого слова (Иванов Иван Иванович)
export function capitalizeName(val: string): string {
  return val.replace(/(?:^|\s)\S/g, c => c.toUpperCase())
}

// Заглавная первая буква строки
export function capitalizeFirst(val: string): string {
  if (!val) return val
  return val.charAt(0).toUpperCase() + val.slice(1)
}

// 00 123456
export function formatCert(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)} ${d.slice(2)}`
}
