import test from 'node:test'
import assert from 'node:assert/strict'

import { almanacOf } from '../src/almanac.js'
import { isoWeekOf } from '../src/repeat.js'

test('黄历：2026-11-07 是九月廿九、立冬、开日', () => {
  const day = almanacOf('2026-11-07')
  assert.equal(day.lunarText, '九月廿九')
  assert.equal(day.jieQi, '立冬')
  assert.equal(day.zhiXing, '开')
  assert.equal(day.week, '六')
  assert.match(day.ganzhi, /丙午年/)
  assert.match(day.ganzhi, /乙酉日/)
  assert.ok(day.yi.length > 0, '宜不应为空')
  assert.ok(day.pengZu.includes('乙不栽植'))
})

test('黄历：非节气日 jieQi 为空', () => {
  const day = almanacOf('2026-11-09')
  assert.equal(day.jieQi, '')
})

test('黄历：2026 春节是正月初一', () => {
  const day = almanacOf('2026-02-17')
  assert.equal(day.lunarText, '正月初一')
})

test('黄历：每一天都有干支与建除', () => {
  for (const iso of ['2026-01-01', '2026-06-15', '2027-02-06']) {
    const day = almanacOf(iso)
    assert.match(day.ganzhi, /年 .+月 .+日/)
    assert.ok(day.zhiXing.length === 1, `${iso} 建除异常`)
  }
})

test('单双周：ISO 周号奇偶与日期一致', () => {
  assert.equal(isoWeekOf('2026-11-02') % 2, 1)
  assert.equal(isoWeekOf('2026-11-09') % 2, 0)
})

test('星座：边界日期落在正确星座与元素', () => {
  const cases = [
    ['2026-03-20', '双鱼', '水象'],
    ['2026-03-21', '白羊', '火象'],
    ['2026-07-23', '狮子', '火象'],
    ['2026-11-07', '天蝎', '水象'],
    ['2026-11-23', '射手', '火象'],
    ['2026-12-22', '摩羯', '土象'],
  ]
  for (const [iso, sign, element] of cases) {
    const { zodiac } = almanacOf(iso)
    assert.equal(zodiac.sign, sign, iso)
    assert.equal(zodiac.element, element, iso)
    assert.ok(zodiac.ruler, `${iso} 缺守护星`)
  }
})

test('月相：有传统名，不是空串', () => {
  for (const iso of ['2026-11-07', '2026-11-15', '2026-11-23']) {
    assert.ok(almanacOf(iso).yueXiang.length > 0, iso)
  }
})

test('黄历续：冲煞、值神、吉神、吉时都有值', () => {
  const a = almanacOf('2026-11-07')
  assert.match(a.chong, /兔/)
  assert.equal(a.sha, '东')
  assert.ok(a.tianShen.length > 0)
  assert.ok(['黄道', '黑道'].includes(a.tianShenType))
  assert.ok(a.jiShen.length > 0)
  assert.ok(a.xiongSha.length > 0)
  assert.ok(a.jiShi.length > 0)
  for (const slot of a.jiShi) assert.match(slot.from, /^\d{2}:\d{2}$/)
})
