/**
 * 六个工具的定义。刻意把 defineTool 作为参数传进来：
 * 这样脱离 DSH 宿主也能用假 defineTool 单测 execute()，不用起服务。
 */

import { toDate, toISODate, solarToLunar, nextLunarOccurrence, formatLunar } from './lunar.js'
import {
  matchesItem, occurrencesBetween, nextOccurrence, daysUntil, validateItem, REPEAT_KINDS,
} from './repeat.js'
import { newId } from './store.js'
import { normalizeAdvance } from './service.js'
import { normalizeTime, effectiveTime } from './remind.js'
import { toMarkdown, toJSON, toICS } from './export.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const KIND = ['todo', 'anniversary', 'memo']

function splitTags(value) {
  if (!value) return []
  return String(value).split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean)
}

function shiftISO(iso, days) {
  return toISODate(new Date(toDate(iso).getTime() + days * 86_400_000))
}

function inDays(iso, todayISO) {
  return Math.round((toDate(iso).getTime() - toDate(todayISO).getTime()) / 86_400_000)
}

function describeItem(item) {
  const repeat = item.repeat === 'none' ? '单次' : item.repeat
  const calendar = item.calendar === 'lunar' ? '农历' : '公历'
  return `${item.title}（${calendar} · ${repeat}）`
}

function lunarNote(item, iso) {
  if (item.calendar !== 'lunar') return ''
  try {
    return formatLunar(solarToLunar(iso))
  } catch {
    return ''
  }
}

function renderList(rows) {
  if (!rows.length) return [{ type: 'text', text: '没有匹配的记录。' }]
  const lines = ['| 日期 | 距今天 | 事项 | 农历 | id |', '| --- | --- | --- | --- | --- |']
  for (const row of rows) {
    const when = row.inDays === 0 ? '今天' : row.inDays > 0 ? `+${row.inDays} 天` : `${-row.inDays} 天前`
    lines.push(`| ${row.date} | ${when} | ${row.title} | ${row.lunar || '—'} | \`${row.id}\` |`)
  }
  return [{ type: 'text', text: lines.join('\n') }]
}

export function buildTools({ defineTool, store, timeZone = 'Asia/Shanghai', reminderTime = () => '09:00', now = () => new Date() }) {
  // timeZone 可以是字符串，也可以是函数——页面改了设置后工具要立刻跟着变
  const zone = () => (typeof timeZone === 'function' ? timeZone() : timeZone)
  const todayISO = () => toISODate(now(), zone())

  const add = defineTool({
    name: 'jiri_add',
    description: '记录一条纪念日、待办或备忘。农历条目用 lunarMonth/lunarDay 指定，date 填对应的公历锚点（如出生日期）。',
    parameters: {
      title: { type: 'string', required: true, description: '事项名称，如「妈妈的生日」' },
      date: { type: 'string', description: '公历锚点 YYYY-MM-DD；农历条目填出生/起始日，省略时按今天' },
      kind: { type: 'string', description: `类别：${KIND.join(' / ')}` },
      calendar: { type: 'string', description: 'gregorian（公历）或 lunar（农历）' },
      lunarMonth: { type: 'number', description: '农历月 1-12，calendar=lunar 时必填' },
      lunarDay: { type: 'number', description: '农历日 1-30' },
      lunarLeap: { type: 'boolean', description: '是否闰月，默认 false' },
      repeat: { type: 'string', description: `重复规则：${REPEAT_KINDS.join(' / ')}` },
      every: { type: 'number', description: 'customDays 时的间隔天数' },
      weekdayMask: { type: 'number', description: 'weekly 时的周几掩码：周日=1，周一=2，周三=8，周五=32' },
      tags: { type: 'string', description: '标签，逗号分隔，如「家人,生日」' },
      advance: { type: 'string', description: '提前几天提醒，可多个：7,1（逗号分隔，天数 1-30）' },
      remindAt: { type: 'string', description: '这条记录的提醒时刻 HH:mm；省略则用全局设置' },
      note: { type: 'string', description: '备注' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const calendar = args.calendar === 'lunar' ? 'lunar' : 'gregorian'
      const kind = KIND.includes(args.kind) ? args.kind : 'todo'
      const repeat = args.repeat ?? (kind === 'anniversary' ? 'yearly' : 'none')

      let date = args.date?.trim() || null
      if (calendar === 'lunar') {
        if (!args.lunarMonth || !args.lunarDay) throw new Error('农历条目需要 lunarMonth 和 lunarDay')
        if (!date) {
          const hit = nextLunarOccurrence(
            { month: args.lunarMonth, day: args.lunarDay, leap: Boolean(args.lunarLeap) },
            todayISO(),
            { timeZone: zone() },
          )
          if (!hit) throw new Error('找不到下一次对应的农历日期，请补一个 date 锚点')
          date = hit.date
        }
      }
      date ??= todayISO()

      const item = {
        id: newId(),
        kind,
        title: args.title.trim(),
        calendar,
        date,
        repeat,
        every: args.every ?? null,
        weekdayMask: args.weekdayMask ?? 0,
        leapDayFallback: 'feb28',
        tags: splitTags(args.tags),
        advance: normalizeAdvance(args.advance),
        remindAt: normalizeTime(args.remindAt),
        note: args.note ?? '',
        skipped: [],
        done: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      if (calendar === 'lunar') {
        item.lunar = { month: args.lunarMonth, day: args.lunarDay, leap: Boolean(args.lunarLeap) }
      }

      const errors = validateItem(item)
      if (errors.length) throw new Error(errors.join('；'))

      await store.insert(item)
      const next = nextOccurrence(item, todayISO()) ?? null
      const days = next ? inDays(next, todayISO()) : null
      const when = next ? `${next}${days === 0 ? '（今天）' : `（${days} 天后）`}` : '暂无下一次'
      return {
        id: item.id,
        next,
        inDays: days,
        message: `已记下：${describeItem(item)}，下一次 ${when}。`,
      }
    },
  })

  const list = defineTool({
    name: 'jiri_list',
    description: '查询纪念日 / 待办 / 备忘。scope=upcoming 时返回未来 days 天内即将发生的。',
    parameters: {
      scope: { type: 'string', description: 'today / upcoming / overdue / all，默认 upcoming' },
      days: { type: 'number', description: 'upcoming 的前瞻天数，默认 30' },
      tag: { type: 'string', description: '按标签过滤' },
      query: { type: 'string', description: '按标题模糊搜索' },
      limit: { type: 'number', description: '最多返回条数，默认 50' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => renderList(value.rows),
    },
    async execute(args) {
      const scope = args.scope ?? 'upcoming'
      const days = Number.isFinite(args.days) ? Number(args.days) : 30
      const limit = Number.isFinite(args.limit) ? Number(args.limit) : 50
      const today = todayISO()

      let items = await store.list()
      if (args.tag) {
        const tag = String(args.tag)
        items = items.filter((item) => item.tags?.includes(tag))
      }
      if (args.query) {
        const query = String(args.query).toLowerCase()
        items = items.filter((item) => item.title.toLowerCase().includes(query))
      }

      const rows = []
      for (const item of items) {
        if (scope === 'all') {
          rows.push({
            id: item.id,
            title: item.title,
            date: item.date,
            inDays: inDays(item.date, today),
            lunar: lunarNote(item, item.date),
          })
          continue
        }
        if (scope === 'today') {
          if (matchesItem(item, today) && !(item.done ?? []).includes(today)) {
            rows.push({ id: item.id, title: item.title, date: today, inDays: 0, lunar: lunarNote(item, today) })
          }
          continue
        }
        if (scope === 'overdue') {
          const overdue = item.repeat === 'none' && item.date < today && !(item.done ?? []).includes(item.date)
          if (overdue) {
            rows.push({
              id: item.id, title: item.title, date: item.date,
              inDays: inDays(item.date, today), lunar: lunarNote(item, item.date),
            })
          }
          continue
        }
        // upcoming
        const end = shiftISO(today, days)
        const hits = occurrencesBetween(item, today, end)
          .filter((hit) => !(item.done ?? []).includes(hit))
        if (hits.length) {
          rows.push({
            id: item.id, title: item.title, date: hits[0],
            inDays: inDays(hits[0], today), lunar: lunarNote(item, hits[0]),
          })
        }
      }

      rows.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1))
      const trimmed = rows.slice(0, limit)
      return {
        count: trimmed.length,
        total: rows.length,
        rows: trimmed,
        message: trimmed.length ? `${trimmed.length} 条` : '没有匹配的记录',
      }
    },
  })

  const done = defineTool({
    name: 'jiri_done',
    description: '把某一次发生标记为完成（或跳过）。occurrence 省略时默认今天，今天不命中则取下一次。',
    parameters: {
      id: { type: 'string', required: true, description: '记录 id，如 jiri_ab12cd34ef' },
      occurrence: { type: 'string', description: '哪一天的那一次，YYYY-MM-DD' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const item = await store.get(String(args.id))
      if (!item) throw new Error(`找不到记录：${args.id}`)

      const today = todayISO()
      const occurrence = args.occurrence?.trim()
        || (matchesItem(item, today) ? today : nextOccurrence(item, today) ?? today)

      const doneDates = new Set(item.done ?? [])
      doneDates.add(occurrence)
      const updated = await store.patch(item.id, { done: [...doneDates].sort() })
      return {
        id: item.id,
        occurrence,
        message: `已完成：${item.title} · ${occurrence}${updated ? '' : '（写入失败）'}`,
      }
    },
  })

  const update = defineTool({
    name: 'jiri_update',
    description: '修改一条记录的标题、日期、重复规则、标签或备注。',
    parameters: {
      id: { type: 'string', required: true },
      title: { type: 'string' },
      date: { type: 'string', description: 'YYYY-MM-DD' },
      repeat: { type: 'string', description: REPEAT_KINDS.join(' / ') },
      every: { type: 'number' },
      weekdayMask: { type: 'number' },
      tags: { type: 'string', description: '逗号分隔' },
      note: { type: 'string' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const item = await store.get(String(args.id))
      if (!item) throw new Error(`找不到记录：${args.id}`)

      const fields = {}
      if (args.title !== undefined) fields.title = String(args.title)
      if (args.date !== undefined) fields.date = String(args.date)
      if (args.repeat !== undefined) fields.repeat = String(args.repeat)
      if (args.every !== undefined) fields.every = Number(args.every)
      if (args.weekdayMask !== undefined) fields.weekdayMask = Number(args.weekdayMask)
      if (args.tags !== undefined) fields.tags = splitTags(args.tags)
      if (args.note !== undefined) fields.note = String(args.note)
      if (!Object.keys(fields).length) throw new Error('没有要修改的字段')

      const merged = { ...item, ...fields }
      const errors = validateItem(merged)
      if (errors.length) throw new Error(errors.join('；'))

      const updated = await store.patch(item.id, fields)
      const next = nextOccurrence(updated, todayISO())
      return {
        id: item.id,
        next,
        message: `已更新：${describeItem(updated)}${next ? `，下一次 ${next}` : ''}。`,
      }
    },
  })

  const remove = defineTool({
    name: 'jiri_delete',
    description: '删除一条记录。',
    parameters: {
      id: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const removed = await store.remove(String(args.id))
      if (!removed) throw new Error(`找不到记录：${args.id}`)
      return { id: removed.id, message: `已删除：${removed.title}` }
    },
  })

  const lunar = defineTool({
    name: 'jiri_lunar',
    description: '公历转农历，或求某个农历月/日下一次对应的公历日期。',
    parameters: {
      date: { type: 'string', description: '公历 YYYY-MM-DD，省略则用今天' },
      month: { type: 'number', description: '农历月 1-12' },
      day: { type: 'number', description: '农历日 1-30' },
      leap: { type: 'boolean', description: '是否闰月' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      if (args.month && args.day) {
        const hit = nextLunarOccurrence(
          { month: Number(args.month), day: Number(args.day), leap: Boolean(args.leap) },
          args.date?.trim() || todayISO(),
          { timeZone: zone() },
        )
        if (!hit) throw new Error('这个农历日期在未来一年内没有出现（闰月？）')
        return {
          date: hit.date,
          lunar: formatLunar(hit.lunar),
          message: `下一次${formatLunar({ ...hit.lunar, leap: Boolean(args.leap) })}是 ${hit.date}。`,
        }
      }

      const iso = args.date?.trim() || todayISO()
      const converted = solarToLunar(iso, zone())
      return {
        date: iso,
        lunar: formatLunar(converted),
        month: converted.month,
        day: converted.day,
        leap: converted.leap,
        message: `${iso} 是 ${converted.year} 年${formatLunar(converted)}。`,
      }
    },
  })


  const brief = defineTool({
    name: 'jiri_brief',
    description: '生成记日简报：今天到未来 N 天的纪念日与待办。定时任务用它做主动提醒。',
    parameters: {
      days: { type: 'number', description: '前瞻天数，默认 3' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const days = Number.isFinite(args.days) ? Number(args.days) : 3
      const today = todayISO()
      const end = shiftISO(today, days)
      const items = await store.list()
      const rows = []
      for (const item of items) {
        for (const hit of occurrencesBetween(item, today, end)) {
          if ((item.done ?? []).includes(hit)) continue
          const distance = inDays(hit, today)
          rows.push({
            date: hit,
            inDays: distance,
            title: item.title,
            lunar: lunarNote(item, hit),
            id: item.id,
            // 提前提醒：今天正好是「发生日 - N 天」中的某一个点
            advanceHit: distance > 0 && normalizeAdvance(item.advance).includes(distance),
            advance: normalizeAdvance(item.advance),
          })
        }
      }
      rows.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1))

      const line = (row) => {
        const when = row.inDays === 0 ? '今天' : row.inDays === 1 ? '明天' : `${row.inDays} 天后`
        return `- ${row.date}（${when}）${row.title}${row.lunar ? ` · ${row.lunar}` : ''}`
      }
      const todayRows = rows.filter((row) => row.inDays === 0)
      const reminderRows = rows.filter((row) => row.advanceHit)
      const rest = rows.filter((row) => row.inDays > 0 && !row.advanceHit)

      const sections = [`记日简报 · ${today}`]
      if (reminderRows.length) sections.push('【提前提醒】', ...reminderRows.map((row) => `- ${row.title} 还有 ${row.inDays} 天（${row.date}）`))
      if (todayRows.length) sections.push('【今天】', ...todayRows.map(line))
      if (rest.length) sections.push('【接下来】', ...rest.map(line))
      if (!rows.length) sections.push(`到 ${end} 没有安排。`)

      return {
        today,
        end,
        days,
        count: rows.length,
        reminders: reminderRows.length,
        rows,
        message: sections.join('\n'),
      }
    },
  })

  const exportTool = defineTool({
    name: 'jiri_export',
    description: '导出全部记录，格式支持 json（备份）/ markdown（阅读）/ ics（导入系统日历）。',
    parameters: {
      format: { type: 'string', description: 'json / markdown / ics，默认 json' },
      path: { type: 'string', description: '输出路径；省略时写到 ~/.dsh/exports/' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const format = ['json', 'markdown', 'ics'].includes(args.format) ? args.format : 'json'
      const today = todayISO()
      const items = await store.list()
      const text = format === 'markdown'
        ? toMarkdown(items, { today, timeZone: zone() })
        : format === 'ics'
          ? toICS(items, { today, timeZone: zone() })
          : toJSON(items, { today })
      const extension = format === 'ics' ? 'ics' : format === 'markdown' ? 'md' : 'json'
      const home = process.env.DSH_HOME || join(homedir(), '.dsh')
      const target = args.path?.trim() || join(home, 'exports', `jiri-${today}.${extension}`)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, text, 'utf8')
      return { path: target, format, bytes: Buffer.byteLength(text), message: `已导出 ${items.length} 条到 ${target}` }
    },
  })

  const reminders = defineTool({
    name: 'jiri_reminders',
    description: '只返回今天需要提醒的内容：提前提醒命中 + 今天到期。定时任务用这个工具；没有内容时 hasReminders 为 false。',
    parameters: {
      time: { type: 'string', description: '本次投递对应的时刻 HH:mm，按记录归属的时间过滤' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const today = todayISO()
      const wanted = normalizeTime(args.time)
      const items = await store.list()
      const ahead = []
      const due = []

      for (const item of items) {
        if (wanted && effectiveTime(item, reminderTime()) !== wanted) continue
        const points = normalizeAdvance(item.advance)
        const done = item.done ?? []

        for (const hit of occurrencesBetween(item, today, today)) {
          if (done.includes(hit)) continue
          due.push({ id: item.id, title: item.title, date: hit, lunar: lunarNote(item, hit) })
        }

        if (!points.length) continue
        for (const hit of occurrencesBetween(item, today, shiftISO(today, 30))) {
          if (done.includes(hit)) continue
          const distance = inDays(hit, today)
          if (distance > 0 && points.includes(distance)) {
            ahead.push({ id: item.id, title: item.title, date: hit, inDays: distance, lunar: lunarNote(item, hit) })
          }
        }
      }

      const byDate = (left, right) => (left.date === right.date ? left.title.localeCompare(right.title) : left.date < right.date ? -1 : 1)
      ahead.sort(byDate)
      due.sort(byDate)

      const lines = []
      if (ahead.length) {
        lines.push('【提前提醒】', ...ahead.map((row) => `- ${row.title} 还有 ${row.inDays} 天（${row.date}）${row.lunar ? ` · ${row.lunar}` : ''}`))
      }
      if (due.length) {
        lines.push('【今天】', ...due.map((row) => `- ${row.title}${row.lunar ? ` · ${row.lunar}` : ''}`))
      }

      const hasReminders = ahead.length + due.length > 0
      return {
        today,
        hasReminders,
        ahead,
        due,
        message: hasReminders
          ? `记日提醒 · ${today}\n${lines.join('\n')}`
          : `记日提醒 · ${today}：没有需要提醒的事项。`,
      }
    },
  })

  return [add, list, done, update, remove, lunar, brief, reminders, exportTool]
}
