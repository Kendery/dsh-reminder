import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createStore } from '../src/store.js'
import { buildTools } from '../src/tools.js'

/** 假 defineTool：原样返回，测试直接调 execute */
const defineTool = (definition) => definition

const NOW = new Date('2026-11-07T04:00:00Z') // 上海时间 2026-11-07 12:00
const now = () => NOW

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-jiri-'))
  const file = join(dir, 'items.json')
  const store = createStore(file)
  const tools = Object.fromEntries(
    buildTools({ defineTool, store, now }).map((tool) => [tool.name, tool]),
  )
  return { dir, file, store, tools }
}

test('jiri_add：农历生日，自动算出下一次', async () => {
  const { tools } = await setup()
  const result = await tools.jiri_add.execute({
    title: '妈妈的生日',
    kind: 'anniversary',
    calendar: 'lunar',
    lunarMonth: 8,
    lunarDay: 8,
  })
  assert.match(result.id, /^jiri_[0-9a-f]{10}$/)
  assert.ok(result.next, '应有下一次')
  assert.ok(result.inDays > 0)
  assert.match(result.message, /妈妈的生日/)
})

test('jiri_list：今天的待办会出现在 today 里', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '交房租', date: '2026-11-07' })
  const result = await tools.jiri_list.execute({ scope: 'today' })
  assert.equal(result.count, 1)
  assert.equal(result.rows[0].title, '交房租')
  assert.equal(result.rows[0].inDays, 0)
})

test('jiri_done：标记完成后 today 不再出现', async () => {
  const { tools } = await setup()
  const added = await tools.jiri_add.execute({ title: '交房租', date: '2026-11-07' })
  const done = await tools.jiri_done.execute({ id: added.id })
  assert.equal(done.occurrence, '2026-11-07')

  const result = await tools.jiri_list.execute({ scope: 'today' })
  assert.equal(result.count, 0)
})

test('jiri_list：upcoming 能看到 30 天内的重复事项', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '每周复盘', date: '2026-11-02', repeat: 'weekly', weekdayMask: 0b0000010 })
  const result = await tools.jiri_list.execute({ scope: 'upcoming', days: 14 })
  assert.ok(result.count >= 1)
  assert.equal(result.rows[0].title, '每周复盘')
})

test('jiri_list：overdue 只返回过期未完成的单次事项', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '过期的单次', date: '2026-11-01' })
  await tools.jiri_add.execute({ title: '过期但已完成', date: '2026-11-02' })
  await tools.jiri_add.execute({ title: '未来的', date: '2026-12-01' })

  const before = await tools.jiri_list.execute({ scope: 'overdue' })
  assert.equal(before.count, 2)

  const doneId = before.rows.find((row) => row.title === '过期但已完成').id
  await tools.jiri_done.execute({ id: doneId, occurrence: '2026-11-02' })

  const after = await tools.jiri_list.execute({ scope: 'overdue' })
  assert.equal(after.count, 1)
  assert.equal(after.rows[0].title, '过期的单次')
})

test('jiri_update：改标题与重复规则', async () => {
  const { tools } = await setup()
  const added = await tools.jiri_add.execute({ title: '旧标题', date: '2026-11-07' })
  const updated = await tools.jiri_update.execute({
    id: added.id, title: '新标题', repeat: 'yearly',
  })
  assert.equal(updated.next, '2026-11-07') // 今天正好是周年，下一次就是今天

  const listed = await tools.jiri_list.execute({ scope: 'all' })
  assert.equal(listed.rows[0].title, '新标题')
})

test('jiri_delete：删除后查不到', async () => {
  const { tools } = await setup()
  const added = await tools.jiri_add.execute({ title: '临时', date: '2026-11-07' })
  await tools.jiri_delete.execute({ id: added.id })
  const listed = await tools.jiri_list.execute({ scope: 'all' })
  assert.equal(listed.count, 0)
})

test('jiri_delete：id 不存在时报错', async () => {
  const { tools } = await setup()
  await assert.rejects(() => tools.jiri_delete.execute({ id: 'jiri_nope' }), /找不到记录/)
})

test('jiri_lunar：公历转农历', async () => {
  const { tools } = await setup()
  const result = await tools.jiri_lunar.execute({ date: '2025-08-01' })
  assert.equal(result.month, 6)
  assert.equal(result.day, 8)
  assert.equal(result.leap, true)
  assert.equal(result.lunar, '农历闰六月初八')
})

test('jiri_lunar：农历反查公历', async () => {
  const { tools } = await setup()
  const result = await tools.jiri_lunar.execute({ month: 8, day: 15 })
  assert.match(result.date, /^2027-09-15$/)
})

test('存储：并发写入不会互相覆盖', async () => {
  const { store } = await setup()
  await Promise.all(
    Array.from({ length: 8 }, (_, index) => store.insert({
      id: `jiri_test${index}`, title: `并发 ${index}`, date: '2026-11-07', repeat: 'none',
    })),
  )
  const items = await store.list()
  assert.equal(items.length, 8)
})

test('存储：文件是合法 JSON，且是原子写出的完整内容', async () => {
  const { tools, file } = await setup()
  await tools.jiri_add.execute({ title: '持久化', date: '2026-11-07' })
  const raw = await readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  assert.equal(parsed.version, 1)
  assert.equal(parsed.items.length, 1)
  assert.equal(parsed.items[0].title, '持久化')
})

test('jiri_brief：提前提醒会单独成段', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '结婚纪念日', date: '2026-11-09', advance: 2 })
  const brief = await tools.jiri_brief.execute({ days: 7 })
  assert.equal(brief.reminders, 1)
  assert.match(brief.message, /【提前提醒】/)
  assert.match(brief.message, /还有 2 天/)
})

test('jiri_brief：今天的事项单独成段', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '交房租', date: '2026-11-07' })
  const brief = await tools.jiri_brief.execute({ days: 3 })
  assert.match(brief.message, /【今天】/)
  assert.match(brief.message, /交房租/)
})

test('jiri_add：advance 支持多个点，超出范围会被夹到 30', async () => {
  const { tools, store } = await setup()
  const added = await tools.jiri_add.execute({ title: '远期', date: '2026-12-01', advance: '7,1,99' })
  const item = await store.get(added.id)
  assert.deepEqual(item.advance, [1, 7, 30])
})

test('jiri_reminders：命中提前点才提醒', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '体检', date: '2026-11-09', advance: '2,1' })
  const hit = await tools.jiri_reminders.execute({})
  assert.equal(hit.hasReminders, true)
  assert.equal(hit.ahead.length, 1)
  assert.equal(hit.ahead[0].inDays, 2)
  assert.match(hit.message, /还有 2 天/)
})

test('jiri_reminders：没有命中时 hasReminders=false', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '远期', date: '2026-12-01', advance: '2' })
  const result = await tools.jiri_reminders.execute({})
  assert.equal(result.hasReminders, false)
  assert.match(result.message, /没有需要提醒/)
})

test('jiri_reminders：今天到期单独列出', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '交房租', date: '2026-11-07' })
  const result = await tools.jiri_reminders.execute({})
  assert.equal(result.due.length, 1)
  assert.match(result.message, /【今天】/)
})

test('jiri_reminders：按 time 过滤，只报归属该时刻的记录', async () => {
  const { tools } = await setup()
  await tools.jiri_add.execute({ title: '早间项', date: '2026-11-09', advance: '2' })
  await tools.jiri_add.execute({ title: '晚间项', date: '2026-11-09', advance: '2', remindAt: '20:30' })

  const morning = await tools.jiri_reminders.execute({ time: '09:00' })
  assert.deepEqual(morning.ahead.map((row) => row.title), ['早间项'])

  const evening = await tools.jiri_reminders.execute({ time: '20:30' })
  assert.deepEqual(evening.ahead.map((row) => row.title), ['晚间项'])
})
