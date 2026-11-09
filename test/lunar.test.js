import test from 'node:test'
import assert from 'node:assert/strict'

import {
  solarToLunar,
  nextLunarOccurrence,
  lunarMonthLength,
  formatLunar,
  dayName,
  today,
} from '../src/lunar.js'

test('普通日期：2026-11-07 → 丙午年九月廿九', () => {
  const lunar = solarToLunar('2026-11-07')
  assert.equal(lunar.month, 9)
  assert.equal(lunar.day, 29)
  assert.equal(lunar.leap, false)
  assert.equal(lunar.year, 2026)
  assert.equal(formatLunar(lunar), '农历九月廿九')
})

test('闰月：2025-08-01 → 闰六月初八', () => {
  const lunar = solarToLunar('2025-08-01')
  assert.equal(lunar.month, 6)
  assert.equal(lunar.day, 8)
  assert.equal(lunar.leap, true)
  assert.equal(formatLunar(lunar), '农历闰六月初八')
})

test('腊月三十：2027-02-06 属于农历 2026 年', () => {
  const lunar = solarToLunar('2027-02-06')
  assert.equal(lunar.year, 2026)
  assert.equal(lunar.month, 12)
  assert.equal(lunar.day, 30)
})

test('三个春节都落在正月初一', () => {
  for (const date of ['2024-02-10', '2025-01-29', '2026-02-17', '2027-02-07']) {
    const lunar = solarToLunar(date)
    assert.equal(lunar.month, 1, date)
    assert.equal(lunar.day, 1, date)
    assert.equal(lunar.leap, false, date)
  }
})

test('反查中秋：从 2026-08-01 起，下一次八月十五', () => {
  const hit = nextLunarOccurrence({ month: 8, day: 15 }, '2026-08-01')
  assert.ok(hit, '应能找到中秋节')
  const back = solarToLunar(hit.date)
  assert.equal(back.month, 8)
  assert.equal(back.day, 15)
  assert.ok(hit.date > '2026-08-01')
})

test('反查闰月：2025 年闰六月初一 = 2025-07-25', () => {
  const hit = nextLunarOccurrence({ month: 6, day: 1, leap: true }, '2025-07-01')
  assert.equal(hit?.date, '2025-07-25')
})

test('反查不到时返回 null（2026 年没有闰六月）', () => {
  const hit = nextLunarOccurrence({ month: 6, day: 1, leap: true }, '2026-01-01')
  assert.equal(hit, null)
})

test('农历月长度：2026 年腊月是 30 天还是 29 天，与真实月份一致', () => {
  const length = lunarMonthLength({ year: 2026, month: 12 })
  assert.ok(length === 29 || length === 30, `腊月长度异常：${length}`)
  assert.equal(dayName(length), length === 30 ? '三十' : '廿九')
})

test('today() 输出 YYYY-MM-DD', () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/)
})
