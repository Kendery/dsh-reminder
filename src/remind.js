/**
 * 提醒时间的纯逻辑：每条记录可以有自己的 HH:mm，缺省跟随全局设置。
 *
 * 投递机制：每个不同的时间点对应一条 schedule 任务，任务里把 time 传给
 * jiri_reminders，工具再按「这条记录实际归属的时间」过滤。
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** '9:00' / '09:00' / 空 → 'HH:mm' 或 null */
export function normalizeTime(value) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  if (!text) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** 这条记录实际用哪个时间：自己的优先，否则全局 */
export function effectiveTime(item, globalTime = '09:00') {
  return normalizeTime(item?.remindAt) ?? normalizeTime(globalTime) ?? '09:00'
}

/**
 * 需要哪些时间点的定时任务：只算「设了提前提醒」的记录。
 * @returns {string[]} 升序去重的 HH:mm
 */
export function collectTimes(items, globalTime = '09:00') {
  const times = new Set([normalizeTime(globalTime) ?? '09:00'])
  for (const item of items) {
    const points = Array.isArray(item?.advance) ? item.advance : []
    if (!points.length) continue
    times.add(effectiveTime(item, globalTime))
  }
  return [...times].sort()
}
