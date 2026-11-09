import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRows, buildMonth } from '../src/view.js'

const TODAY = '2026-11-07'

const daily = { id: 'a', title: '喝水', date: '2026-01-01', repeat: 'daily', calendar: 'gregorian', kind: 'todo' }
const lunar = {
  id: 'b', title: '中秋', date: '2000-01-01', repeat: 'yearly', calendar: 'lunar',
  lunar: { month: 8, day: 15, leap: false }, kind: 'anniversary',
}
const once = { id: 'c', title: '交房租', date: '2026-11-10', repeat: 'none', calendar: 'gregorian', kind: 'todo' }

test('buildMonth：2026-11 有 30 天，首日周几与 Date 一致', () => {
  const month = buildMonth([], 2026, 11, TODAY)
  assert.equal(month.days.length, 30)
  assert.equal(month.firstWeekday, new Date(Date.UTC(2026, 10, 1)).getUTCDay())
  assert.equal(month.today, TODAY)
})

test('buildMonth：每天重复的事项出现在每一天', () => {
  const month = buildMonth([daily], 2026, 11, TODAY)
  for (const day of month.days) {
    assert.equal(day.items.length, 1, `${day.date} 应命中`)
    assert.equal(day.items[0].title, '喝水')
  }
})

test('buildMonth：单次事项只落在当天', () => {
  const month = buildMonth([once], 2026, 11, TODAY)
  const hits = month.days.filter((day) => day.items.length > 0)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].date, '2026-11-10')
})

test('buildMonth：农历中秋落在 2026-09-25', () => {
  const month = buildMonth([lunar], 2026, 9, TODAY)
  const hits = month.days.filter((day) => day.items.length > 0)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].date, '2026-09-25')
  assert.equal(hits[0].items[0].lunar, '农历八月十五')
})

test('buildMonth：没有农历八月十五的月份不命中', () => {
  const month = buildMonth([lunar], 2026, 3, TODAY)
  assert.equal(month.days.filter((day) => day.items.length > 0).length, 0)
})

test('buildRows：仍然是一条记录一行，日期取下一次', () => {
  const rows = buildRows([daily, once, lunar], TODAY)
  assert.equal(rows.length, 3)
  const rent = rows.find((row) => row.id === 'c')
  assert.equal(rent.date, '2026-11-10')
  assert.equal(rent.inDays, 3)
})
