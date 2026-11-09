import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createStore } from '../src/store.js'
import { addItem, updateItem, removeItem, markDone, undoDone } from '../src/service.js'
import { solarToLunar } from '../src/lunar.js'

const TODAY = '2026-11-07'

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-jiri-service-'))
  return createStore(join(dir, 'items.json'))
}

test('addItem：农历纪念日自动算出下一次', async () => {
  const store = await setup()
  const item = await addItem(store, {
    title: '妈妈的生日', kind: 'anniversary', calendar: 'lunar', lunarMonth: 8, lunarDay: 8,
  }, { today: TODAY })
  assert.equal(item.repeat, 'yearly')
  assert.equal(solarToLunar(item.date).month, 8)
  assert.equal((await store.list()).length, 1)
})

test('addItem：标题为空会被拦', async () => {
  const store = await setup()
  await assert.rejects(() => addItem(store, { title: '  ' }, { today: TODAY }), /title/)
})

test('updateItem：改标题和重复规则', async () => {
  const store = await setup()
  const item = await addItem(store, { title: '旧', date: '2026-11-10' }, { today: TODAY })
  const updated = await updateItem(store, item.id, { title: '新', repeat: 'yearly' })
  assert.equal(updated.title, '新')
  assert.equal(updated.repeat, 'yearly')
})

test('updateItem：农历切到公历会丢掉 lunar 分量', async () => {
  const store = await setup()
  const item = await addItem(store, {
    title: '生日', calendar: 'lunar', lunarMonth: 8, lunarDay: 8,
  }, { today: TODAY })
  const updated = await updateItem(store, item.id, { calendar: 'gregorian', date: '2027-01-01' })
  assert.equal(updated.calendar, 'gregorian')
  assert.equal(updated.lunar, undefined)
  assert.equal(updated.date, '2027-01-01')
})

test('updateItem：公历改农历带闰月', async () => {
  const store = await setup()
  const item = await addItem(store, { title: '生日', date: '2026-11-07' }, { today: TODAY })
  const updated = await updateItem(store, item.id, {
    calendar: 'lunar', lunarMonth: 6, lunarDay: 1, lunarLeap: true,
  })
  assert.deepEqual(updated.lunar, { month: 6, day: 1, leap: true })
})

test('updateItem：不存在的 id 报错', async () => {
  const store = await setup()
  await assert.rejects(() => updateItem(store, 'jiri_nope', { title: 'x' }), /找不到记录/)
})

test('removeItem：删除后列表为空', async () => {
  const store = await setup()
  const item = await addItem(store, { title: '临时', date: '2026-11-07' }, { today: TODAY })
  await removeItem(store, item.id)
  assert.equal((await store.list()).length, 0)
})

test('markDone：记录完成日期', async () => {
  const store = await setup()
  const item = await addItem(store, { title: '交房租', date: '2026-11-07' }, { today: TODAY })
  const result = await markDone(store, item.id, undefined, TODAY)
  assert.equal(result.occurrence, '2026-11-07')
  assert.deepEqual((await store.get(item.id)).done, ['2026-11-07'])
})

test('undoDone：撤销某一次完成', async () => {
  const store = await setup()
  const item = await addItem(store, { title: '交房租', date: '2026-11-07' }, { today: TODAY })
  await markDone(store, item.id, '2026-11-07', TODAY)
  const back = await undoDone(store, item.id, '2026-11-07')
  assert.deepEqual(back.done, [])
})
