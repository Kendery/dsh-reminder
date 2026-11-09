/**
 * 重复规则展开。与 iOS 端 Shared/Models/TodoItem.swift 的 RepeatKind 一一对应：
 *   none / daily / weekly / monthly / yearly / biweeklyOdd / biweeklyEven / customDays
 *
 * 设计取舍：不预生成日程表，而是提供「某一天是否命中」的纯谓词 matchesItem()，
 * 再按区间逐日扫描。区间通常是「今天起 30 天」，代价可忽略，换来的是
 * 农历年、闰月、大小月、2/29 这些边界全部退化成同一条判断路径。
 */

import { solarToLunar, toDate, toISODate } from './lunar.js'

export const REPEAT_KINDS = [
  'none', 'daily', 'weekly', 'monthly', 'yearly',
  'biweeklyOdd', 'biweeklyEven', 'customDays',
]

const DAY_MS = 86_400_000

/** 周几，0=周日（和 Date#getUTCDay 一致） */
export function weekdayOf(iso) {
  return toDate(iso).getUTCDay()
}

/** ISO 8601 周序号，用于单/双周 */
export function isoWeekOf(iso) {
  const date = toDate(iso)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNumber = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function shift(iso, days) {
  return toISODate(new Date(toDate(iso).getTime() + days * DAY_MS))
}

function split(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

/** 农历某次命中的最后一天：用来处理「腊月三十」落到只有廿九的年份 */
function isLastDayOfLunarMonth(iso, lunar) {
  const next = solarToLunar(shift(iso, 1))
  return next.month !== lunar.month || next.leap !== lunar.leap
}

function matchGregorianYearly(item, iso) {
  const anchor = split(item.date)
  const target = split(iso)

  // 2/29 出生：平年按 feb28 或 mar1 降级（对应 iOS 端的 LeapDayFallback）
  if (anchor.month === 2 && anchor.day === 29 && !isLeapYear(target.year)) {
    const fallback = item.leapDayFallback ?? 'feb28'
    return fallback === 'mar1'
      ? target.month === 3 && target.day === 1
      : target.month === 2 && target.day === 28
  }
  return target.month === anchor.month && target.day === anchor.day
}

function matchLunarYearly(item, iso) {
  const target = solarToLunar(iso)
  const wanted = item.lunar
  if (target.month !== wanted.month) return false
  if (target.leap !== Boolean(wanted.leap)) return false
  if (target.day === wanted.day) return true

  // 该月只有廿九：要求三十的那年落到月末那一天
  if (wanted.day === 30 && target.day === 29 && isLastDayOfLunarMonth(iso, target)) return true
  return false
}

function matchMonthly(item, iso) {
  const anchorDay = split(item.date).day
  const target = split(iso)
  const lastDay = daysInMonth(target.year, target.month)
  return target.day === Math.min(anchorDay, lastDay)
}

function matchBiweekly(item, iso) {
  if (weekdayOf(iso) !== weekdayOf(item.date)) return false
  const parity = isoWeekOf(iso) % 2
  return item.repeat === 'biweeklyOdd' ? parity === 1 : parity === 0
}

function matchCustomDays(item, iso) {
  const every = Number(item.every)
  if (!Number.isFinite(every) || every < 2) return false
  const diff = Math.round((toDate(iso).getTime() - toDate(item.date).getTime()) / DAY_MS)
  return diff >= 0 && diff % every === 0
}

/**
 * 某一天是否命中这条记录。
 * @param {object} item 见 README 的数据模型
 * @param {string} iso  YYYY-MM-DD
 */
export function matchesItem(item, iso) {
  if (!item?.date || iso < item.date) return false
  if (item.skipped?.includes(iso)) return false

  switch (item.repeat ?? 'none') {
    case 'none': return iso === item.date
    case 'daily': return true
    case 'weekly': return ((item.weekdayMask ?? 0) >> weekdayOf(iso)) & 1 ? true : false
    case 'monthly': return matchMonthly(item, iso)
    case 'yearly':
      return item.calendar === 'lunar'
        ? matchLunarYearly(item, iso)
        : matchGregorianYearly(item, iso)
    case 'biweeklyOdd':
    case 'biweeklyEven': return matchBiweekly(item, iso)
    case 'customDays': return matchCustomDays(item, iso)
    default: return false
  }
}

/** [from, to] 闭区间内所有命中日期 */
export function occurrencesBetween(item, from, to) {
  if (to < from) return []
  const out = []
  for (let cursor = from; cursor <= to; cursor = shift(cursor, 1)) {
    if (matchesItem(item, cursor)) out.push(cursor)
  }
  return out
}

/** 从 from 起（含当天）往后找最近一次 */
export function nextOccurrence(item, from, horizonDays = 400) {
  let cursor = from
  const end = shift(from, horizonDays)
  while (cursor <= end) {
    if (matchesItem(item, cursor)) return cursor
    cursor = shift(cursor, 1)
  }
  return null
}

/** 距离下一次还有几天（今天 → 0） */
export function daysUntil(item, from, horizonDays = 400) {
  const next = nextOccurrence(item, from, horizonDays)
  if (!next) return null
  return Math.round((toDate(next).getTime() - toDate(from).getTime()) / DAY_MS)
}

/** 写入前的基本校验，返回错误信息数组（空数组表示通过） */
export function validateItem(item) {
  const errors = []
  if (!item?.title || typeof item.title !== 'string') errors.push('title 必填')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item?.date ?? '')) errors.push('date 必须是 YYYY-MM-DD')
  if (!REPEAT_KINDS.includes(item?.repeat ?? 'none')) errors.push(`repeat 不支持：${item?.repeat}`)
  if ((item?.repeat ?? 'none') === 'customDays' && !(Number(item?.every) >= 2)) {
    errors.push('customDays 需要 every ≥ 2')
  }
  if (item?.calendar === 'lunar') {
    const lunar = item.lunar ?? {}
    if (!(lunar.month >= 1 && lunar.month <= 12)) errors.push('lunar.month 必须在 1-12')
    if (!(lunar.day >= 1 && lunar.day <= 30)) errors.push('lunar.day 必须在 1-30')
  }
  return errors
}
