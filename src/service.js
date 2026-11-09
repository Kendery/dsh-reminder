/**
 * 写入服务：工具（模型调用）和页面（人工操作）共用同一套校验与落库逻辑，
 * 避免两边口径不一致。
 */

import { nextOccurrence, validateItem } from './repeat.js'
import { nextLunarOccurrence } from './lunar.js'
import { newId } from './store.js'
import { normalizeTime } from './remind.js'

export const KINDS = ['todo', 'anniversary', 'memo']

/**
 * 提前提醒天数：支持 0 / 数字 / 数组 / "7,1" 字符串，统一成去重升序的数组。
 * 兼容旧数据（advance 是单个数字）。
 */
export function normalizeAdvance(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，\s]+/).filter(Boolean)
      : value === undefined || value === null || value === ''
        ? []
        : [value]

  const points = new Set()
  for (const entry of raw) {
    const days = Math.trunc(Number(entry))
    if (!Number.isFinite(days)) continue
    if (days <= 0) continue
    points.add(Math.min(30, days))
  }
  return [...points].sort((left, right) => left - right)
}

export const REPEATS = [
  'none', 'daily', 'weekly', 'monthly', 'yearly',
  'biweeklyOdd', 'biweeklyEven', 'customDays',
]

function splitTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean)
  if (!value) return []
  return String(value).split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean)
}

/** 把「页面表单 / 工具参数」归一成一条完整记录（不含 id），失败时抛错 */
export function draftFrom(input, { timeZone = 'Asia/Shanghai', today } = {}) {
  const calendar = input.calendar === 'lunar' ? 'lunar' : 'gregorian'
  const kind = KINDS.includes(input.kind) ? input.kind : 'todo'
  const repeat = REPEATS.includes(input.repeat)
    ? input.repeat
    : (kind === 'anniversary' ? 'yearly' : 'none')

  let date = input.date?.trim() || null
  if (calendar === 'lunar') {
    const month = Number(input.lunarMonth)
    const day = Number(input.lunarDay)
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 30)) {
      throw new Error('农历日期需要月份 1-12、日 1-30')
    }
    if (!date) {
      const hit = nextLunarOccurrence({ month, day, leap: Boolean(input.lunarLeap) }, today, { timeZone })
      if (!hit) throw new Error('这个农历日期在未来一年内没有出现，请补一个公历锚点')
      date = hit.date
    }
  }
  date ??= today

  const item = {
    id: newId(),
    kind,
    title: String(input.title ?? '').trim(),
    calendar,
    date,
    repeat,
    every: input.every ?? null,
    weekdayMask: Number(input.weekdayMask ?? 0),
    leapDayFallback: input.leapDayFallback ?? 'feb28',
    advance: normalizeAdvance(input.advance),
    remindAt: normalizeTime(input.remindAt),
    tags: splitTags(input.tags),
    note: input.note ?? '',
    skipped: [],
    done: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  if (calendar === 'lunar') {
    item.lunar = {
      month: Number(input.lunarMonth),
      day: Number(input.lunarDay),
      leap: Boolean(input.lunarLeap),
    }
  }

  const errors = validateItem(item)
  if (errors.length) throw new Error(errors.join('；'))
  return item
}

export async function addItem(store, input, context) {
  const item = draftFrom(input, context)
  await store.insert(item)
  return item
}

const EDITABLE = ['title', 'date', 'repeat', 'every', 'weekdayMask', 'tags', 'note', 'kind', 'advance', 'remindAt']

export async function updateItem(store, id, fields) {
  const current = await store.get(id)
  if (!current) throw new Error(`找不到记录：${id}`)

  const patch = {}
  for (const key of EDITABLE) {
    if (fields[key] === undefined) continue
    if (key === 'tags') patch[key] = splitTags(fields[key])
    else if (key === 'advance') patch[key] = normalizeAdvance(fields[key])
    else if (key === 'remindAt') patch[key] = normalizeTime(fields[key])
    else patch[key] = fields[key]
  }

  // 页面可以改历法与农历分量，工具不必改，所以单独处理
  if (fields.calendar !== undefined) {
    patch.calendar = fields.calendar === 'lunar' ? 'lunar' : 'gregorian'
  }
  const calendar = patch.calendar ?? current.calendar
  if (calendar === 'lunar') {
    if (fields.lunarMonth !== undefined || fields.lunarDay !== undefined || fields.lunarLeap !== undefined) {
      patch.lunar = {
        month: Number(fields.lunarMonth ?? current.lunar?.month ?? 1),
        day: Number(fields.lunarDay ?? current.lunar?.day ?? 1),
        leap: Boolean(fields.lunarLeap ?? current.lunar?.leap),
      }
    }
  } else if (patch.calendar === 'gregorian') {
    patch.lunar = undefined
  }

  if (!Object.keys(patch).length) throw new Error('没有要修改的字段')

  const merged = { ...current, ...patch }
  const errors = validateItem(merged)
  if (errors.length) throw new Error(errors.join('；'))

  return store.patch(id, patch)
}

export async function removeItem(store, id) {
  const removed = await store.remove(id)
  if (!removed) throw new Error(`找不到记录：${id}`)
  return removed
}

export async function markDone(store, id, occurrence, today) {
  const item = await store.get(id)
  if (!item) throw new Error(`找不到记录：${id}`)
  const target = occurrence || (item.repeat === 'none' ? item.date : nextOccurrence(item, today) || today)
  const done = new Set(item.done ?? [])
  done.add(target)
  const updated = await store.patch(id, { done: [...done].sort() })
  return { item: updated, occurrence: target }
}

export async function undoDone(store, id, occurrence) {
  const item = await store.get(id)
  if (!item) throw new Error(`找不到记录：${id}`)
  const done = (item.done ?? []).filter((entry) => entry !== occurrence)
  return store.patch(id, { done })
}
