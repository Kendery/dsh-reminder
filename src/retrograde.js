/**
 * 水星逆行区间：用星历算水星的地心视黄经，黄经在减小就是逆行。
 *
 * 采样 12 小时一格，区间端点精确到天（±12h）。结果按「起止日期」缓存，
 * 月历切页不会重复计算。
 */

import * as A from 'astronomy-engine'

const DAY = 86_400_000
const STEP = 12 * 3600 * 1000
const cache = new Map()

function longitude(date) {
  const vector = A.GeoVector(A.Body.Mercury, date, true)
  return A.Ecliptic(vector).elon
}

function unwrap(delta) {
  if (delta > 180) return delta - 360
  if (delta < -180) return delta + 360
  return delta
}

const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10)

/**
 * @param {string} startISO YYYY-MM-DD
 * @param {string} endISO   YYYY-MM-DD
 * @returns {{ start: string, end: string }[]} 起止都含当天
 */
export function mercuryRetrogradeRanges(startISO, endISO) {
  const key = `${startISO}..${endISO}`
  if (cache.has(key)) return cache.get(key)

  const from = Date.parse(`${startISO}T00:00:00Z`) - STEP
  const to = Date.parse(`${endISO}T00:00:00Z`) + STEP
  const ranges = []
  let current = null
  let previous = null

  for (let time = from; time <= to; time += STEP) {
    const lon = longitude(new Date(time))
    if (previous !== null) {
      const retrograde = unwrap(lon - previous) < 0
      const day = isoOf(time)
      if (retrograde) {
        if (current === null) current = { start: isoOf(time - STEP), end: day }
        else current.end = day
      } else if (current !== null) {
        ranges.push(current)
        current = null
      }
    }
    previous = lon
  }
  if (current !== null) ranges.push(current)

  if (cache.size > 24) cache.clear()
  cache.set(key, ranges)
  return ranges
}

/** 某天是否在水逆区间内 */
export function isRetrograde(iso, ranges) {
  return ranges.some((range) => iso >= range.start && iso <= range.end)
}
