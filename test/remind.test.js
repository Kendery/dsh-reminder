import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeTime, effectiveTime, collectTimes } from '../src/remind.js'

test('normalizeTime：补零、拒绝非法值', () => {
  assert.equal(normalizeTime('9:05'), '09:05')
  assert.equal(normalizeTime(' 20:30 '), '20:30')
  assert.equal(normalizeTime('09:05'), '09:05')
  assert.equal(normalizeTime('24:00'), null)
  assert.equal(normalizeTime('12:60'), null)
  assert.equal(normalizeTime('abc'), null)
  assert.equal(normalizeTime(''), null)
  assert.equal(normalizeTime(undefined), null)
})

test('effectiveTime：自己的时刻优先，否则用全局', () => {
  assert.equal(effectiveTime({ remindAt: '20:30' }, '09:00'), '20:30')
  assert.equal(effectiveTime({ remindAt: null }, '09:00'), '09:00')
  assert.equal(effectiveTime({}, '08:15'), '08:15')
  assert.equal(effectiveTime({ remindAt: 'bad' }, '08:15'), '08:15')
})

test('collectTimes：始终包含全局时间，只收集设了提前点的记录', () => {
  const items = [
    { advance: [1], remindAt: '20:30' },
    { advance: [], remindAt: '07:00' },
    { advance: [3] },
    { advance: [2], remindAt: '20:30' },
  ]
  assert.deepEqual(collectTimes(items, '09:00'), ['09:00', '20:30'])
})

test('collectTimes：没有提前提醒时只剩全局时间', () => {
  assert.deepEqual(collectTimes([{ advance: [] }], '09:00'), ['09:00'])
})
