export type Person = {id: string; alias: string; skills: string[]; availability: [number, number][]; limit: number; preference: string}
export type Task = {id: string; title: string; skills: string[]; start: number; end: number}
export type EventInput = {title: string; date: string; zone: string; people: Person[]; tasks: Task[]}
export type EventMeta = {revision: number; version: number; count: number; last: string}
export type Schedule = {revision: number; assignments: Record<string, string>; workload: Record<string, number>; request: string}
export type Attempt = {revision: number; version: number; status: 'published' | 'infeasible'; task?: string}
export const newId = () => crypto.randomUUID()
export const today = () => new Date().toISOString().slice(0, 10)
export const emptyEvent = (): EventInput => ({title: '', date: today(), zone: 'UTC', people: [], tasks: []})
export const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
export function minute(value: string) {
  if (!/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(value)) return -1
  const [hour, minutes] = value.split(':').map(Number)
  return hour * 60 + minutes
}
export const splitSkills = (value: string) => [...new Set(value.toLowerCase().split(',').map(part => part.trim()).filter(Boolean))]
export const validInterval = (a: number, b: number) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b <= 1440 && a < b

export function eligible(person: Person, task: Task) {
  if (!task.skills.every(skill => person.skills.includes(skill)) || task.end - task.start > person.limit) return false
  let covered = task.start
  for (const [start, end] of [...person.availability].sort((a, b) => a[0] - b[0])) {
    if (start > covered) break
    covered = Math.max(covered, end)
    if (covered >= task.end) return true
  }
  return false
}
export function inputError(event: EventInput) {
  const bytes = (text: string) => new TextEncoder().encode(text).length
  const validSkills = (values: string[]) => values.length <= 8 && values.every(skill => /^[a-z0-9_-]{1,40}$/.test(skill))
  if (!event.title.trim() || bytes(event.title) > 80) return 'Enter an event title of up to 80 bytes.'
  const date = new Date(event.date + 'T00:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== event.date) return 'Choose a valid event date.'
  if (!/^UTC(?:[+-](?:(?:0\d|1[0-3]):(?:00|15|30|45)|14:00))?$/.test(event.zone)) return 'Use UTC or a fixed offset such as UTC+06:00.'
  if (event.people.length > 8 || event.tasks.length > 8 || bytes(JSON.stringify(event)) > 8192) return 'The event exceeds its size limit.'
  for (const person of event.people) {
    if (!person.alias.trim() || bytes(person.alias) > 40 || bytes(person.preference) > 240 || !validSkills(person.skills)) return 'Check participant aliases, skills, and preference lengths.'
    if (!Number.isInteger(person.limit) || person.limit < 1 || person.limit > 1440 || person.availability.length > 8 || person.availability.some(([a, b]) => !validInterval(a, b))) return 'Check availability and workload limits.'
  }
  for (const task of event.tasks) {
    if (!task.title.trim() || bytes(task.title) > 80 || !validSkills(task.skills) || !validInterval(task.start, task.end)) return 'Check task titles, skills, and time ranges.'
  }
  return ''
}
