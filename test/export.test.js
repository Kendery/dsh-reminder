import test from 'node:test'
import assert from 'node:assert/strict'

import { toJSON, toMarkdown, toICS, parseImport } from '../src/export.js'

const TODAY = '2026-11-07'

const lunar = {
  id: 'jiri_a', title: '妈妈的生日', kind: 'anniversary', calendar: 'lunar',
  lunar: { month: 8, day: 8, leap: false }, date: '2020-09-24', repeat: 'yearly', tags: ['家人'],
}
const once = { id: 'jiri_b', title: '交房租', kind: 'todo', calendar: 'gregorian', date: '2026-11-10', repeat: 'none', tags: [] }

test('toJSON：包含版本、导出时间和条目', () => {
  const data = JSON.parse(toJSON([lunar, once], { today: TODAY }))
  assert.equal(data.version, 1)
  assert.equal(data.items.length, 2)
  assert.match(data.exportedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('toMarkdown：表头 + 每行一条', () => {
  const text = toMarkdown([lunar, once], { today: TODAY })
  assert.match(text, /# 记日 · 导出/)
  assert.match(text, /\| 2026-11-10 \| 交房租 \|/)
  assert.match(text, /农历八月初八/)
})

test('toICS：单次事件无 RRULE，年度事件有', () => {
  const text = toICS([lunar, once], { today: TODAY })
  assert.match(text, /BEGIN:VCALENDAR/)
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2)
  assert.match(text, /RRULE:FREQ=YEARLY/)
  assert.match(text, /DTSTART;VALUE=DATE:20261110/)
  assert.match(text, /END:VCALENDAR/)
})

test('parseImport：接受 { items } 与裸数组', () => {
  const wrapped = parseImport(JSON.stringify({ items: [once] }))
  assert.equal(wrapped.items.length, 1)
  assert.equal(wrapped.errors.length, 0)

  const bare = parseImport(JSON.stringify([once]))
  assert.equal(bare.items.length, 1)
})

test('parseImport：坏数据收集 errors 而不是整体失败', () => {
  const result = parseImport(JSON.stringify({ items: [once, { title: '', date: 'x' }] }))
  assert.equal(result.items.length, 1)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /title/)
})

test('parseImport：非 JSON 直接抛错', () => {
  assert.throws(() => parseImport('{oops'), /不是合法 JSON/)
})

test('parseImport：缺 items 数组抛错', () => {
  assert.throws(() => parseImport(JSON.stringify({ foo: 1 })), /items/)
})
