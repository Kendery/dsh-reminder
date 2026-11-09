/**
 * 导出：JSON（备份）、Markdown（给人看）、ICS（喂给系统日历）。
 * 导入只接受本插件导出的 JSON 结构，逐条校验后合并。
 */

import { validateItem, nextOccurrence } from './repeat.js'
import { solarToLunar, formatLunar } from './lunar.js'

const pad = (value) => String(value).padStart(2, '0')

function compactDate(iso) {
  return iso.replaceAll('-', '')
}

function icsEscape(text) {
  return String(text).replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n')
}

/** RRULE 只覆盖本插件支持的规则；单次事件不写 RRULE */
function rruleOf(item) {
  switch (item.repeat) {
    case 'daily': return 'FREQ=DAILY'
    case 'weekly': return 'FREQ=WEEKLY'
    case 'monthly': return 'FREQ=MONTHLY'
    case 'yearly': return 'FREQ=YEARLY'
    case 'biweeklyOdd':
    case 'biweeklyEven': return 'FREQ=WEEKLY;INTERVAL=2'
    case 'customDays': return `FREQ=DAILY;INTERVAL=${Math.max(2, Number(item.every) || 2)}`
    default: return null
  }
}

export function toJSON(items, { today } = {}) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), today, items }, null, 2)
}

export function toMarkdown(items, { today, timeZone = 'Asia/Shanghai' } = {}) {
  const lines = ['# 记日 · 导出', '', `导出日期：${today}`, '', '| 日期 | 事项 | 农历 | 类型 | 重复 | 标签 |', '| --- | --- | --- | --- | --- | --- |']
  const rows = items
    .map((item) => ({ item, next: nextOccurrence(item, today) ?? item.date }))
    .sort((left, right) => (left.next === right.next ? 0 : left.next < right.next ? -1 : 1))

  for (const { item, next } of rows) {
    let lunar = ''
    if (item.calendar === 'lunar') {
      try { lunar = formatLunar(solarToLunar(next, timeZone)) } catch { lunar = '' }
    }
    lines.push(`| ${next} | ${item.title} | ${lunar || '—'} | ${item.kind ?? 'todo'} | ${item.repeat ?? 'none'} | ${(item.tags ?? []).join('、') || '—'} |`)
  }
  return `${lines.join('\n')}\n`
}

export function toICS(items, { today, timeZone = 'Asia/Shanghai' } = {}) {
  const stamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 15) + 'Z'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dsh-reminder//记日//CN',
    'CALSCALE:GREGORIAN',
  ]

  for (const item of items) {
    const date = nextOccurrence(item, today) ?? item.date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const next = new Date(Date.parse(date + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10)
    const rule = rruleOf(item)
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${item.id}@dsh-reminder`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART;VALUE=DATE:${compactDate(date)}`)
    lines.push(`DTEND;VALUE=DATE:${compactDate(next)}`)
    lines.push(`SUMMARY:${icsEscape(item.title)}`)
    if (item.note) lines.push(`DESCRIPTION:${icsEscape(item.note)}`)
    if (rule) lines.push(`RRULE:${rule}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

/** 导入：接受 { items } 或裸数组；返回 { added, skipped, errors } */
export function parseImport(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('不是合法 JSON')
  }
  const items = Array.isArray(parsed) ? parsed : parsed?.items
  if (!Array.isArray(items)) throw new Error('找不到 items 数组')

  const accepted = []
  const errors = []
  items.forEach((raw, index) => {
    const item = {
      ...raw,
      id: typeof raw?.id === 'string' ? raw.id : undefined,
      tags: Array.isArray(raw?.tags) ? raw.tags : [],
      done: Array.isArray(raw?.done) ? raw.done : [],
      skipped: Array.isArray(raw?.skipped) ? raw.skipped : [],
    }
    const problems = validateItem(item)
    if (problems.length) errors.push(`第 ${index + 1} 条：${problems.join('；')}`)
    else accepted.push(item)
  })
  return { items: accepted, errors }
}

export const EXPORT_FORMATS = { json: 'application/json', markdown: 'text/markdown', ics: 'text/calendar' }
export { pad }
