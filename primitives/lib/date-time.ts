/** Format a Date for an HTML datetime-local input in the user's local timezone. */
export function toDatetimeLocalValue(date: Date): string {
  assertValidDate(date)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Convert an HTML datetime-local value to a canonical UTC ISO timestamp. */
export function datetimeLocalToIso(value: string): string {
  const date = new Date(value)
  assertValidDate(date)
  return date.toISOString()
}

/** Combine an HTML date value and an HTML time value into a UTC ISO timestamp. */
export function dateAndTimeToIso(date: string, time: string): string {
  return datetimeLocalToIso(`${date}T${time}`)
}

/** Add minutes to an HTML datetime-local value and return another local value. */
export function addMinutesToDatetimeLocal(value: string, minutes: number): string {
  const date = new Date(value)
  assertValidDate(date)
  date.setMinutes(date.getMinutes() + minutes)
  return toDatetimeLocalValue(date)
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date')
}
