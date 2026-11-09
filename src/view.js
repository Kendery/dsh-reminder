/**
 * 页面数据投影：
 *   · buildRows  —— 列表视图，每条记录只取「下一次」
 *   · buildMonth —— 月历视图，把整月每一天命中的记录展开
 * 两个视图共用同一个 rowOf，保证编辑表单拿到的字段一致。
 */

import { nextOccurrence, matchesItem, isoWeekOf } from './repeat.js'
import { almanacOf } from './almanac.js'
import { normalizeAdvance } from './service.js'
import { mercuryRetrogradeRanges, isRetrograde } from './retrograde.js'
import { solarToLunar, formatLunar, toDate } from './lunar.js'

const pad = (value) => String(value).padStart(2, '0')

function daysBetween(fromISO, toISO) {
  return Math.round((toDate(toISO).getTime() - toDate(fromISO).getTime()) / 86_400_000)
}

function lunarLabel(item, iso) {
  if (item.calendar !== 'lunar') return ''
  try {
    return formatLunar(solarToLunar(iso))
  } catch {
    return ''
  }
}

function rowOf(item, iso, todayISO) {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind ?? 'todo',
    calendar: item.calendar ?? 'gregorian',
    repeat: item.repeat ?? 'none',
    every: item.every ?? null,
    weekdayMask: item.weekdayMask ?? 0,
    date: iso,
    anchor: item.date,
    weekNo: isoWeekOf(iso),
    inDays: daysBetween(todayISO, iso),
    lunar: lunarLabel(item, iso),
    lunarMonth: item.lunar?.month ?? null,
    lunarDay: item.lunar?.day ?? null,
    lunarLeap: Boolean(item.lunar?.leap),
    advance: normalizeAdvance(item.advance),
    remindAt: item.remindAt ?? null,
    tags: item.tags ?? [],
    note: item.note ?? '',
    done: item.done ?? [],
    doneNow: (item.done ?? []).includes(iso),
    overdue: item.repeat === 'none' && iso < todayISO && !(item.done ?? []).includes(iso),
    today: iso === todayISO,
  }
}

function sortRows(left, right) {
  if (left.date !== right.date) return left.date < right.date ? -1 : 1
  return left.title.localeCompare(right.title)
}

/** 列表视图：每条记录只出现一次，取下一次（或原始日期） */
export function buildRows(items, todayISO) {
  const rows = items.map((item) => rowOf(item, nextOccurrence(item, todayISO) ?? item.date, todayISO))
  return rows.sort(sortRows)
}

/**
 * 月历视图：某个月每一天命中的记录。
 * @returns {{ year, month, firstWeekday, days: { date, day, items }[], today }}
 *   firstWeekday 0=周日，前端按它留空格。
 */
export function buildMonth(items, year, month, todayISO) {
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // 多算前后 40 天，月历格子的“逆”标记和卡片里的“下次水逆”都要用
  const monthStart = `${year}-${pad(month)}-01`
  const monthEnd = `${year}-${pad(month)}-${pad(total)}`
  const windowStart = new Date(Date.parse(`${monthStart}T00:00:00Z`) - 40 * 86_400_000).toISOString().slice(0, 10)
  const windowEnd = new Date(Date.parse(`${monthEnd}T00:00:00Z`) + 40 * 86_400_000).toISOString().slice(0, 10)
  const retrograde = mercuryRetrogradeRanges(windowStart, windowEnd)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const days = []
  for (let day = 1; day <= total; day += 1) {
    const iso = `${year}-${pad(month)}-${pad(day)}`
    const hits = items
      .filter((item) => matchesItem(item, iso))
      .map((item) => rowOf(item, iso, todayISO))
    days.push({
      date: iso,
      day,
      items: hits,
      almanac: almanacOf(iso),
      weekNo: isoWeekOf(iso),
      mercuryRetrograde: isRetrograde(iso, retrograde),
    })
  }
  const firstWeekdayMonday = (firstWeekday + 6) % 7
  return {
    year,
    month,
    firstWeekday,
    firstWeekdayMonday,
    days,
    retrograde: retrograde.filter((range) => range.end >= monthStart && range.start <= monthEnd),
    today: todayISO,
  }
}
