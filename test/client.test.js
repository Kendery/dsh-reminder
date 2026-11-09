/**
 * 浏览器面渲染测试：用真实 React 做 SSR，检查月历/黄历/表单的结构。
 * 这些组件没有副作用，renderToStaticMarkup 足够覆盖。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)

globalThis.__DSH_JIRI_TEST__ = true
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      globalThis.__client = { id, mod: factory(require) }
    },
  },
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 1200,
  localStorage: { getItem: () => null, setItem() {} },
  confirm: () => true,
}

await import('../src/client.js')
const { CalendarGrid, AlmanacCard, ZodiacCard, MercuryStrip, Form, colorOf, when, weekLabel } = globalThis.__client.mod.__test

const almanac = (lunarDay, jieQi = '') => ({
  lunarDay, lunarText: `九月${lunarDay}`, ganzhi: '丙午年 己亥月 乙酉日', jieQi,
  zhiXing: '开', yi: ['解除'], ji: ['无'], pengZu: '乙不栽植', week: '六',
  yueXiang: '晓', zodiac: { sign: '天蝎', element: '水象', ruler: '冥王星', range: '10/24 – 11/22' },
})

function makeMonth() {
  const days = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-11-${String(index + 1).padStart(2, '0')}`,
    day: index + 1,
    items: index === 9 ? [{ id: 'jiri_x', title: '交房租', kind: 'todo' }] : [],
    almanac: index === 6 ? almanac('立冬', '立冬') : almanac(['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十'][index % 10]),
    weekNo: 44 + Math.floor(index / 7),
  }))
  return { year: 2026, month: 11, firstWeekday: 0, firstWeekdayMonday: 6, days, today: '2026-11-07' }
}

test('CalendarGrid：渲染出单/双周标签与日期', () => {
  const html = renderToStaticMarkup(React.createElement(CalendarGrid, {
    month: makeMonth(), selected: null, onSelect() {}, onPrev() {}, onNext() {}, onToday() {},
  }))
  assert.match(html, /单周/)
  assert.match(html, /双周/)
  assert.match(html, />7</)
  assert.match(html, /立冬/)
})

test('CalendarGrid：compact 模式隐藏农历日', () => {
  const normal = renderToStaticMarkup(React.createElement(CalendarGrid, {
    month: makeMonth(), selected: null, onSelect() {}, onPrev() {}, onNext() {}, onToday() {},
  }))
  const compact = renderToStaticMarkup(React.createElement(CalendarGrid, {
    month: makeMonth(), selected: null, compact: true, onSelect() {}, onPrev() {}, onNext() {}, onToday() {},
  }))
  assert.match(normal, /初[一二三四五六七八九]/)
  assert.doesNotMatch(compact, /初[一二三四五六七八九]/)
})

test('CalendarGrid：月历为空时给出占位', () => {
  const html = renderToStaticMarkup(React.createElement(CalendarGrid, { month: null }))
  assert.match(html, /加载月历/)
})

test('AlmanacCard：干支、宜忌、建除都在', () => {
  const html = renderToStaticMarkup(React.createElement(AlmanacCard, {
    day: { date: '2026-11-07', almanac: almanac('廿九', '立冬') },
  }))
  assert.match(html, /丙午年/)
  assert.match(html, /宜/)
  assert.match(html, /忌/)
  assert.match(html, /开日/)
  assert.match(html, /彭祖百忌/)
})

test('AlmanacCard：没有选中日时不渲染', () => {
  const html = renderToStaticMarkup(React.createElement(AlmanacCard, { day: null }))
  assert.equal(html, '')
})

test('Form：公历模式有日期输入，农历模式有月日选择', () => {
  const base = {
    title: '生日', kind: 'anniversary', calendar: 'gregorian', date: '2026-11-07',
    lunarMonth: 8, lunarDay: 8, lunarLeap: false, repeat: 'yearly', every: 3, weekdayMask: 0, tags: '',
  }
  const gregorian = renderToStaticMarkup(React.createElement(Form, {
    form: base, setForm() {}, onSubmit() {}, onCancel() {}, mode: 'new',
  }))
  assert.match(gregorian, /type="date"/)
  assert.match(gregorian, /添加/)

  const lunar = renderToStaticMarkup(React.createElement(Form, {
    form: { ...base, calendar: 'lunar' }, setForm() {}, onSubmit() {}, onCancel() {}, mode: 'edit',
  }))
  assert.match(lunar, /闰月/)
  assert.match(lunar, /保存/)
  assert.doesNotMatch(lunar, /type="date"/)
})

test('辅助函数：颜色稳定、单双周、距今文案', () => {
  assert.equal(colorOf('jiri_a'), colorOf('jiri_a'))
  assert.match(colorOf('jiri_a'), /^#[0-9a-f]{6}$/)
  assert.equal(weekLabel(44), '双周')
  assert.equal(weekLabel(45), '单周')
  assert.equal(when({ inDays: 0 }), '今天')
  assert.equal(when({ inDays: 1 }), '明天')
  assert.equal(when({ inDays: 5 }), '5 天后')
  assert.equal(when({ inDays: -2 }), '已过 2 天')
})

test('ZodiacCard：星座、元素、守护星、月相分栏展示', () => {
  const html = renderToStaticMarkup(React.createElement(ZodiacCard, {
    day: { date: '2026-11-07', almanac: almanac('廿九', '立冬') },
  }))
  assert.match(html, /天蝎座/)
  assert.match(html, /水象/)
  assert.match(html, /冥王星/)
  assert.match(html, /月相/)
  assert.match(html, /晓/)
})

test('ZodiacCard：缺少星座数据时不渲染', () => {
  const html = renderToStaticMarkup(React.createElement(ZodiacCard, {
    day: { date: '2026-11-07', almanac: { lunarDay: '廿九' } },
  }))
  assert.equal(html, '')
})

test('MercuryStrip：水逆中显示区间与剩余天数', () => {
  const month = { retrograde: [{ start: '2026-10-24', end: '2026-11-13' }], today: '2026-11-07' }
  const html = renderToStaticMarkup(React.createElement(MercuryStrip, { month, today: '2026-11-07' }))
  assert.match(html, /水逆中/)
  assert.match(html, /2026-10-24/)
  assert.match(html, /还有 6 天/)
})

test('MercuryStrip：不在区间时显示下次开始', () => {
  const month = { retrograde: [{ start: '2027-02-09', end: '2027-03-03' }], today: '2026-11-07' }
  const html = renderToStaticMarkup(React.createElement(MercuryStrip, { month, today: '2026-11-07' }))
  assert.match(html, /下次/)
  assert.match(html, /2027-02-09/)
})


const richAlmanac = () => ({
  lunarDay: '廿九', lunarText: '九月廿九', ganzhi: '丙午年 己亥月 乙酉日', jieQi: '立冬', zhiXing: '开',
  yi: ['解除'], ji: ['无'], pengZu: '乙不栽植', week: '六', yueXiang: '晓',
  zodiac: { sign: '天蝎', element: '水象', ruler: '冥王星', range: '10/24 – 11/22' },
  chong: '(己卯)兔', sha: '东', tianShen: '朱雀', tianShenType: '黑道',
  jiShen: ['天德', '母仓'], xiongSha: ['灾煞', '天火'],
  xiu: '柳土獐', xiuLuck: '凶', naYin: '泉中水', positions: { xi: '西北', fu: '西南', cai: '东北' },
  jiShi: [{ zhi: '子', from: '00:00', to: '00:59' }, { zhi: '寅', from: '03:00', to: '04:59' }],
})

test('AlmanacCard：默认折叠，冲煞/值神/吉时可见', () => {
  const html = renderToStaticMarkup(React.createElement(AlmanacCard, {
    day: { date: '2026-11-07', almanac: richAlmanac() },
  }))
  assert.match(html, /冲煞/)
  assert.match(html, /煞东/)
  assert.match(html, /朱雀/)
  assert.match(html, /黑道/)
  assert.match(html, /柳土獐/)
  assert.match(html, /泉中水/)
  assert.match(html, /喜神 西北/)
  assert.match(html, /子 00:00/)
  assert.doesNotMatch(html, /天德/)
  assert.match(html, /展开/)
})

test('AlmanacCard：展开后显示吉神与凶煞', () => {
  const html = renderToStaticMarkup(React.createElement(AlmanacCard, {
    day: { date: '2026-11-07', almanac: richAlmanac() }, defaultOpen: true,
  }))
  assert.match(html, /天德 · 母仓/)
  assert.match(html, /灾煞 · 天火/)
  assert.match(html, /收起/)
})
