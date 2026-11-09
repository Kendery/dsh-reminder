import test from 'node:test'
import assert from 'node:assert/strict'

import {
  matchesItem,
  occurrencesBetween,
  nextOccurrence,
  daysUntil,
  validateItem,
  weekdayOf,
  isoWeekOf,
} from '../src/repeat.js'
import { solarToLunar, lunarMonthLength } from '../src/lunar.js'

const base = { id: 't', kind: 'todo', title: '测试', date: '2026-01-01', repeat: 'none' }

test('none：只命中当天', () => {
  const item = { ...base, date: '2026-11-10' }
  assert.equal(matchesItem(item, '2026-11-10'), true)
  assert.equal(matchesItem(item, '2026-11-11'), false)
})

test('起点之前不命中', () => {
  const item = { ...base, repeat: 'daily', date: '2026-11-10' }
  assert.equal(matchesItem(item, '2026-11-09'), false)
})

test('daily：区间内每天都命中', () => {
  const item = { ...base, repeat: 'daily' }
  assert.deepEqual(
    occurrencesBetween(item, '2026-11-07', '2026-11-10'),
    ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10'],
  )
})

test('weekly：只命中掩码里的周几', () => {
  // 周一、周三、周五
  const mask = (1 << 1) | (1 << 3) | (1 << 5)
  const item = { ...base, repeat: 'weekly', weekdayMask: mask }
  const hits = occurrencesBetween(item, '2026-11-02', '2026-11-08')
  assert.equal(hits.length, 3)
  for (const hit of hits) assert.ok([1, 3, 5].includes(weekdayOf(hit)), `${hit} 不是周一三五`)
})

test('monthly：31 号遇到小月落到月末', () => {
  const item = { ...base, date: '2026-01-31', repeat: 'monthly' }
  assert.deepEqual(occurrencesBetween(item, '2026-02-01', '2026-02-28'), ['2026-02-28'])
  assert.deepEqual(occurrencesBetween(item, '2026-03-01', '2026-03-31'), ['2026-03-31'])
  // 4 月只有 30 天
  assert.deepEqual(occurrencesBetween(item, '2026-04-01', '2026-04-30'), ['2026-04-30'])
})

test('yearly（公历）：按出生月日每年命中', () => {
  const item = { ...base, date: '1990-03-15', repeat: 'yearly', calendar: 'gregorian' }
  assert.deepEqual(occurrencesBetween(item, '2027-03-01', '2027-03-31'), ['2027-03-15'])
})

test('yearly（公历）：2/29 在平年按策略降级', () => {
  const feb28 = { ...base, date: '2000-02-29', repeat: 'yearly', leapDayFallback: 'feb28' }
  const mar1 = { ...base, date: '2000-02-29', repeat: 'yearly', leapDayFallback: 'mar1' }
  assert.deepEqual(occurrencesBetween(feb28, '2027-02-01', '2027-03-31'), ['2027-02-28'])
  assert.deepEqual(occurrencesBetween(mar1, '2027-02-01', '2027-03-31'), ['2027-03-01'])
  // 闰年仍按 2/29
  assert.deepEqual(occurrencesBetween(feb28, '2028-02-01', '2028-03-31'), ['2028-02-29'])
})

test('yearly（农历）：八月十五每年命中一次', () => {
  const item = {
    ...base,
    date: '2000-01-01',
    repeat: 'yearly',
    calendar: 'lunar',
    lunar: { month: 8, day: 15, leap: false },
  }
  const hits = occurrencesBetween(item, '2026-01-01', '2026-12-31')
  assert.equal(hits.length, 1)
  const lunar = solarToLunar(hits[0])
  assert.equal(lunar.month, 8)
  assert.equal(lunar.day, 15)
  assert.equal(lunar.leap, false)
})

test('yearly（农历）：闰月只有闰年才有，平年不命中', () => {
  const item = {
    ...base,
    date: '2020-01-01',
    repeat: 'yearly',
    calendar: 'lunar',
    lunar: { month: 6, day: 1, leap: true },
  }
  assert.deepEqual(occurrencesBetween(item, '2025-07-01', '2025-07-31'), ['2025-07-25'])
  assert.deepEqual(occurrencesBetween(item, '2026-01-01', '2026-12-31'), [])
})

test('yearly（农历）：该月只有廿九时，「三十」落到月末', () => {
  // 找一个腊月只有 29 天的农历年
  let lunarYear = null
  for (let y = 2020; y <= 2035; y += 1) {
    if (lunarMonthLength({ year: y, month: 12 }) === 29) { lunarYear = y; break }
  }
  assert.ok(lunarYear, '应能找到腊月只有 29 天的农历年')

  const item = {
    ...base,
    date: '2019-01-01',
    repeat: 'yearly',
    calendar: 'lunar',
    lunar: { month: 12, day: 30, leap: false },
  }
  // 腊月落在农历年结束后的公历 1–2 月
  const from = `${lunarYear + 1}-01-01`
  const to = `${lunarYear + 1}-02-28`
  const hits = occurrencesBetween(item, from, to)
  assert.equal(hits.length, 1, `农历 ${lunarYear} 年腊月应只命中一次，实际 ${JSON.stringify(hits)}`)
  const lunar = solarToLunar(hits[0])
  assert.equal(lunar.year, lunarYear)
  assert.equal(lunar.day, 29, '应降级到廿九')
})

test('biweeklyOdd：同一个周几，每两周一次', () => {
  const item = { ...base, date: '2026-11-02', repeat: 'biweeklyOdd' }
  const hits = occurrencesBetween(item, '2026-11-01', '2026-12-20')
  assert.ok(hits.length >= 3)
  const weekday = weekdayOf(item.date)
  for (const hit of hits) {
    assert.equal(weekdayOf(hit), weekday, `${hit} 周几不一致`)
    assert.equal(isoWeekOf(hit) % 2, 1, `${hit} 不在单周`)
  }
  for (let i = 1; i < hits.length; i += 1) {
    const gap = (Date.parse(hits[i]) - Date.parse(hits[i - 1])) / 86_400_000
    assert.equal(gap, 14)
  }
})

test('customDays：每 N 天', () => {
  const item = { ...base, date: '2026-11-01', repeat: 'customDays', every: 3 }
  assert.deepEqual(
    occurrencesBetween(item, '2026-11-01', '2026-11-10'),
    ['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10'],
  )
})

test('skipped：跳过的那一次不命中', () => {
  const item = { ...base, repeat: 'daily', skipped: ['2026-11-08'] }
  assert.equal(matchesItem(item, '2026-11-08'), false)
  assert.equal(matchesItem(item, '2026-11-09'), true)
})

test('nextOccurrence / daysUntil', () => {
  const item = { ...base, date: '1990-03-15', repeat: 'yearly' }
  assert.equal(nextOccurrence(item, '2026-11-07'), '2027-03-15')
  assert.equal(daysUntil(item, '2026-11-07'), 128)
})

test('validateItem 拦住明显错误', () => {
  assert.deepEqual(validateItem({ title: '生日', date: '1990-03-15', repeat: 'yearly' }), [])
  assert.ok(validateItem({ date: '1990-03-15' }).length > 0)
  assert.ok(validateItem({ title: 'x', date: '1990/03/15' }).length > 0)
  assert.ok(validateItem({ title: 'x', date: '1990-03-15', repeat: 'customDays' }).length > 0)
  assert.ok(validateItem({
    title: 'x', date: '1990-03-15', repeat: 'yearly', calendar: 'lunar', lunar: { month: 13, day: 1 },
  }).length > 0)
})
