import test from 'node:test'
import assert from 'node:assert/strict'

import { mercuryRetrogradeRanges, isRetrograde } from '../src/retrograde.js'

test('2026 年有三次水逆，且 11-07 在区间内', () => {
  const ranges = mercuryRetrogradeRanges('2026-01-01', '2026-12-31')
  assert.equal(ranges.length, 3)
  assert.ok(isRetrograde('2026-11-07', ranges), '11-07 应在水逆中')
  for (const range of ranges) assert.ok(range.start <= range.end)
})

test('区间按时间递增且互不重叠', () => {
  const ranges = mercuryRetrogradeRanges('2026-01-01', '2026-12-31')
  for (let index = 1; index < ranges.length; index += 1) {
    assert.ok(ranges[index - 1].end < ranges[index].start)
  }
})

test('isRetrograde：区间外为 false', () => {
  const ranges = [{ start: '2026-10-24', end: '2026-11-13' }]
  assert.equal(isRetrograde('2026-10-23', ranges), false)
  assert.equal(isRetrograde('2026-10-24', ranges), true)
  assert.equal(isRetrograde('2026-11-13', ranges), true)
  assert.equal(isRetrograde('2026-11-14', ranges), false)
})

test('结果有缓存：同一区间两次调用返回同一引用', () => {
  const first = mercuryRetrogradeRanges('2026-01-01', '2026-12-31')
  const second = mercuryRetrogradeRanges('2026-01-01', '2026-12-31')
  assert.equal(first, second)
})
