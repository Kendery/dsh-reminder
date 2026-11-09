/**
 * 农历换算：基于 Node 内置 Intl 的中国历，零依赖。
 *
 * 只做记日真正需要的事：
 *   1. 公历 → 农历（月 / 日 / 是否闰月）
 *   2. 农历月日 → 未来最近一次对应的公历日期（Intl 没有反向 API，只能逐日扫描）
 *   3. 人类可读的「农历九月廿九」格式化
 *
 * 三个已知边界，与 iOS 端 Shared/Core/LunarCalendar.swift 的结论一致：
 *   · Intl 只给「公历 → 农历」，反查必须扫描；
 *   · 闰月以「闰」前缀出现（en 下是 "bis"），必须单独建模；
 *   · 农历腊月可能只有廿九，没有三十 —— 扫描不到时由调用方决定降级策略。
 */

const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

/** 一月最多 30 天，覆盖一个农历年的最长扫描范围 */
const MAX_SCAN_DAYS = 400

const CN_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

const MONTH_NAMES = new Map([
  ['正月', 1], ['一月', 1],
  ['二月', 2], ['三月', 3], ['四月', 4], ['五月', 5], ['六月', 6],
  ['七月', 7], ['八月', 8], ['九月', 9], ['十月', 10],
  ['冬月', 11], ['十一月', 11],
  ['腊月', 12], ['十二月', 12],
])

const DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

const formatters = new Map()

function formatterFor(timeZone) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone,
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** 解析 YYYY-MM-DD；也接受 Date。统一取当天 12:00 UTC，避开时区把日期推前/推后一天。 */
export function toDate(value) {
  if (value instanceof Date) return value
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) throw new Error(`日期格式应为 YYYY-MM-DD，收到：${value}`)
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12))
  if (Number.isNaN(date.getTime())) throw new Error(`无效日期：${value}`)
  return date
}

/** Date → YYYY-MM-DD（按指定时区取「那一天」） */
export function toISODate(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : toDate(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date)
  const pick = (type) => parts.find((part) => part.type === type)?.value
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/** 今天（指定时区）的 YYYY-MM-DD */
export function today(timeZone = DEFAULT_TIME_ZONE) {
  return toISODate(new Date(), timeZone)
}

function parseDay(raw) {
  if (/^\d+$/.test(raw)) return Number(raw)
  if (raw === '二十') return 20
  if (raw === '三十') return 30
  if (raw.startsWith('廿')) return 20 + (CN_DIGITS[raw[1]] ?? NaN)
  if (raw.startsWith('初')) return CN_DIGITS[raw[1]] ?? NaN
  if (raw === '十') return 10
  if (raw.startsWith('十')) return 10 + (CN_DIGITS[raw[1]] ?? NaN)
  return NaN
}

/**
 * 公历 → 农历。
 * @returns {{ year: number, month: number, day: number, leap: boolean,
 *             monthName: string, ganzhi: string }}
 *   year 是农历年所属的公历年（Intl 的 relatedYear），不是 60 年一轮的序号。
 */
export function solarToLunar(value, timeZone = DEFAULT_TIME_ZONE) {
  const parts = formatterFor(timeZone).formatToParts(toDate(value))
  const pick = (type) => parts.find((part) => part.type === type)?.value

  const monthRaw = pick('month') ?? ''
  const leap = monthRaw.startsWith('闰')
  const monthName = leap ? monthRaw.slice(1) : monthRaw
  const month = MONTH_NAMES.get(monthName)
  const day = parseDay(pick('day') ?? '')

  if (!month || !Number.isFinite(day)) {
    throw new Error(`无法解析农历：${JSON.stringify(parts.map((p) => [p.type, p.value]))}`)
  }

  return {
    year: Number(pick('relatedYear')),
    month,
    day,
    leap,
    monthName,
    ganzhi: pick('yearName') ?? '',
  }
}

/** 1 → 初一，21 → 廿一……30 → 三十 */
export function dayName(day) {
  return DAY_NAMES[day - 1] ?? String(day)
}

/** { month: 9, day: 29, leap: false } → "农历九月廿九" */
export function formatLunar(lunar, { withYear = false } = {}) {
  const prefix = lunar.leap ? '闰' : ''
  const month = lunar.monthName ?? `${lunar.month}月`
  const body = `${prefix}${month}${dayName(lunar.day)}`
  return withYear && lunar.year ? `${lunar.year}年${body}` : `农历${body}`
}

/**
 * 从 from 起（含当天）向后扫描，找最近一次指定农历月/日。
 * 找不到（例如要求「腊月三十」而那年只有廿九）返回 null，由调用方降级。
 */
export function nextLunarOccurrence(
  { month, day, leap = false },
  from,
  { timeZone = DEFAULT_TIME_ZONE, maxDays = MAX_SCAN_DAYS } = {},
) {
  const start = toDate(from)
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const cursor = new Date(start.getTime() + offset * 86_400_000)
    const lunar = solarToLunar(cursor, timeZone)
    if (lunar.month === month && lunar.day === day && lunar.leap === leap) {
      return { date: toISODate(cursor, timeZone), lunar }
    }
  }
  return null
}

/** 某个农历月在该农历年里的天数（30 / 29），用于「腊月三十」这类边界降级 */
export function lunarMonthLength({ year, month, leap = false }, timeZone = DEFAULT_TIME_ZONE) {
  // 春节落在 1/21–2/20 之间：先从 1/1 找到该农历年的正月初一，避免把上一年的腊月算进来
  const scanStart = toDate(`${year}-01-01`)
  let newYear = null
  for (let offset = 0; offset <= 60; offset += 1) {
    const date = new Date(scanStart.getTime() + offset * 86_400_000)
    const lunar = solarToLunar(date, timeZone)
    if (lunar.year === year && lunar.month === 1 && lunar.day === 1 && !lunar.leap) {
      newYear = date
      break
    }
  }
  if (!newYear) return null

  let best = 0
  // 农历平年 354 天、闰年 384 天，必须扫满 400 天才能覆盖到腊月
  for (let offset = 0; offset <= MAX_SCAN_DAYS; offset += 1) {
    const date = new Date(newYear.getTime() + offset * 86_400_000)
    const lunar = solarToLunar(date, timeZone)
    if (lunar.year === year && lunar.month === month && lunar.leap === leap) {
      best = Math.max(best, lunar.day)
    }
  }
  return best || null
}

export const LUNAR_DEFAULT_TIME_ZONE = DEFAULT_TIME_ZONE
