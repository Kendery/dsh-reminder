/**
 * 插件入口。
 *
 * Node 面：
 *   · 8 个工具（含 jiri_brief 简报与 jiri_export 导出）
 *   · 页面读写路由（list / month / add / update / delete / done / export / import / remind）
 *   · 每日提醒（借助宿主的 schedule 服务，投递到新会话）
 * 浏览器面：src/client.js
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { buildTools } from './tools.js'
import { createStore, defaultStorePath, newId } from './store.js'
import { buildRows, buildMonth } from './view.js'
import { addItem, updateItem, removeItem, markDone, undoDone } from './service.js'
import { toJSON, toMarkdown, toICS, parseImport, EXPORT_FORMATS } from './export.js'
import { LUNAR_DEFAULT_TIME_ZONE, toISODate } from './lunar.js'
import { normalizeTime, collectTimes } from './remind.js'

export const name = 'dsh-reminder'
export const inject = ['tools']
export const ITEMS_ROUTE = '/api/dsh-reminder/items'

const REMINDER_TITLE = '记日 · 每日简报'
const reminderPrompt = (time) => `调用 jiri_reminders，time 传 "${time}"。若 hasReminders 为 false，只回复「今天没有提醒」，不要展开；否则按返回的清单原样汇报，不要额外补充建议。`


export function apply(ctx, config = {}) {
  const file = config.file ?? defaultStorePath()

  // 包名从 dsh-jiri 改成 @sunr/dsh-reminder：数据目录跟着改，首次加载自动迁移
  const currentDir = dirname(file)
  const legacyDir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'dsh-jiri')
  if (!existsSync(currentDir) && existsSync(legacyDir)) {
    try { renameSync(legacyDir, currentDir) } catch { /* 迁移失败就沿用空目录 */ }
  }
  const reminderFile = join(dirname(file), 'reminder.json')
  const settingsFile = join(dirname(file), 'settings.json')
  const store = createStore(file)

  const settings = { timeZone: config.timeZone ?? LUNAR_DEFAULT_TIME_ZONE, reminderTime: '09:00' }
  try {
    const saved = JSON.parse(readFileSync(settingsFile, 'utf8'))
    if (typeof saved?.timeZone === 'string') settings.timeZone = saved.timeZone
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(saved?.reminderTime ?? '')) settings.reminderTime = saved.reminderTime
  } catch { /* 没有设置文件就用默认 */ }
  const timeZone = () => settings.timeZone

  for (const tool of buildTools({ defineTool, store, timeZone, reminderTime: () => settings.reminderTime })) ctx.tools.register(tool)

  const today = () => toISODate(new Date(), timeZone())

  async function readReminder() {
    try { return JSON.parse(await readFile(reminderFile, 'utf8')) } catch { return null }
  }

  async function writeReminder(value) {
    await mkdir(dirname(reminderFile), { recursive: true })
    await writeFile(reminderFile, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  }

  async function clearReminder() {
    try { await unlink(reminderFile) } catch { /* 没有就算了 */ }
  }

  // 宿主可能没装 schedule（headless 等），拿不到就降级
  let schedule = null
  ctx.inject(['schedule'], (scope) => { schedule = scope.get('schedule') })

  /** 某条任务用的 RRULE：每天在该时刻触发 */
  function ruleFor(time) {
    const [hour, minute] = time.split(':')
    return `DTSTART;TZID=${settings.timeZone}:${today().replaceAll('-', '')}T${hour}${minute}00\nRRULE:FREQ=DAILY`
  }

  async function createSchedule(time) {
    const created = await schedule.create({
      title: REMINDER_TITLE,
      prompt: reminderPrompt(time),
      timing: { kind: 'rrule', rrule: ruleFor(time) },
      target: { kind: 'new_once' },
    })
    const id = created?.id ?? created?.task?.id ?? created?.value?.id ?? await findReminderId(time)
    if (!id) throw new Error(`任务创建成功但拿不到 id（${time}）`)
    return id
  }

  async function findReminderId(time) {
    try {
      const listed = await schedule.list({ active: true })
      const rows = Array.isArray(listed) ? listed : (listed?.items ?? listed?.tasks ?? [])
      const hit = rows.find((row) => row?.title === REMINDER_TITLE && (time === undefined || String(row?.prompt ?? '').includes(`"${time}"`)))
      return hit?.id ?? null
    } catch { return null }
  }

  /** 旧版只存 { id }，迁移成 { times: { 'HH:mm': id } } */
  function reminderRecord(raw) {
    if (!raw?.id && !raw?.times) return null
    if (raw.times) return raw
    return { times: { [normalizeTime(raw.time) ?? settings.reminderTime]: raw.id }, createdAt: raw.createdAt }
  }

  /**
   * 让「已启用的时间点」与实际任务对齐：缺的建、多的删。
   * 记录增删改、全局时间变更后都要调一次。
   */
  async function syncSchedules() {
    const record = reminderRecord(await readReminder())
    if (!record || !schedule) return record

    const items = await store.list()
    const desired = collectTimes(items, settings.reminderTime)
    const times = { ...record.times }

    for (const time of Object.keys(times)) {
      if (desired.includes(time)) continue
      try { await schedule.edit({ id: times[time], action: 'delete' }) } catch { /* 可能已被手工删除 */ }
      delete times[time]
    }
    for (const time of desired) {
      if (times[time]) continue
      times[time] = await createSchedule(time)
    }

    const next = { times, createdAt: record.createdAt ?? new Date().toISOString(), timeZone: settings.timeZone }
    await writeReminder(next)
    return next
  }

  ctx.inject(['connection'], (scope) => {
    const register = scope.get('connection')?.fetch?.register
    if (typeof register !== 'function') return

    const json = (value, status = 200) => Response.json(value, {
      status,
      headers: { 'cache-control': 'no-store' },
    })

    scope.effect(() => register({
      path: ITEMS_ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        let body = {}
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: { code: 'bad-request', message: 'body 不是 JSON' } }, 400)
        }

        const action = typeof body?.action === 'string' ? body.action : 'list'
        // 必须声明在 try 外：最终 return 在 catch 之后
        let extra = {}
        try {
          if (action === 'month') {
            const year = Number(body.year)
            const month = Number(body.month)
            if (!(year >= 1900 && year <= 2200) || !(month >= 1 && month <= 12)) {
              return json({ ok: false, error: { code: 'bad-month', message: 'year/month 不合法' } }, 400)
            }
            const items = await store.list()
            return json({ ok: true, today: today(), month: buildMonth(items, year, month, today()) })
          }

          switch (action) {
            case 'list':
              break
            case 'add':
              await addItem(store, body.item ?? {}, { timeZone: timeZone(), today: today() })
              break
            case 'update':
              await updateItem(store, String(body.id ?? ''), body.fields ?? {})
              break
            case 'delete':
              extra = { removed: await removeItem(store, String(body.id ?? '')) }
              break
            case 'undone':
              await undoDone(store, String(body.id ?? ''), String(body.occurrence ?? ''))
              break
            case 'restore': {
              const item = body.item
              if (!item || typeof item.id !== 'string') {
                return json({ ok: false, error: { code: 'bad-item', message: '缺少要恢复的记录' } }, 400)
              }
              if (!(await store.get(item.id))) await store.insert(item)
              break
            }
            case 'done':
              await markDone(store, String(body.id ?? ''), body.occurrence, today())
              break
            case 'export': {
              const format = ['json', 'markdown', 'ics'].includes(body.format) ? body.format : 'json'
              const items = await store.list()
              const text = format === 'markdown'
                ? toMarkdown(items, { today: today(), timeZone: timeZone() })
                : format === 'ics'
                  ? toICS(items, { today: today(), timeZone: timeZone() })
                  : toJSON(items, { today: today() })
              const extension = format === 'ics' ? 'ics' : format === 'markdown' ? 'md' : 'json'
              return json({
                ok: true,
                filename: `jiri-${today()}.${extension}`,
                mime: EXPORT_FORMATS[format] ?? 'text/plain',
                data: text,
              })
            }
            case 'import': {
              const parsed = parseImport(String(body.data ?? ''))
              const existing = new Set((await store.list()).map((item) => item.id))
              let added = 0
              let skipped = 0
              for (const item of parsed.items) {
                if (item.id && existing.has(item.id)) { skipped += 1; continue }
                await store.insert({
                  ...item,
                  id: item.id ?? newId(),
                  createdAt: item.createdAt ?? new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
                added += 1
              }
              await syncSchedules()
              return json({ ok: true, added, skipped, errors: parsed.errors, rows: buildRows(await store.list(), today()) })
            }
            case 'settings.get':
              return json({ ok: true, ...settings, today: today() })
            case 'settings.set': {
              const nextZone = body.timeZone === undefined ? settings.timeZone : String(body.timeZone)
              const nextTime = body.reminderTime === undefined ? settings.reminderTime : String(body.reminderTime)
              try {
                new Intl.DateTimeFormat('en-US', { timeZone: nextZone })
              } catch {
                return json({ ok: false, error: { code: 'bad-zone', message: `无效时区：${nextZone}` } }, 400)
              }
              if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(nextTime)) {
                return json({ ok: false, error: { code: 'bad-time', message: `时间格式应为 HH:mm：${nextTime}` } }, 400)
              }

              const changedTime = nextTime !== settings.reminderTime || nextZone !== settings.timeZone
              settings.timeZone = nextZone
              settings.reminderTime = nextTime
              await mkdir(dirname(settingsFile), { recursive: true })
              await writeFile(settingsFile, `${JSON.stringify({ ...settings }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })

              // 时间或时区变了：让任务跟着对齐（会重建 RRULE）
              let reminder = await readReminder()
              if (changedTime) reminder = await syncSchedules()

              return json({ ok: true, ...settings, today: today(), reminder })
            }
            case 'remind.status': {
              const reminder = reminderRecord(await readReminder())
              return json({ ok: true, reminder, supported: Boolean(schedule) })
            }
            case 'remind.on': {
              if (!schedule) {
                return json({ ok: false, error: { code: 'no-schedule', message: '当前 profile 没有 schedule 服务' } }, 400)
              }
              const existing = reminderRecord(await readReminder())
              if (existing) return json({ ok: true, reminder: existing })

              await writeReminder({ times: {}, createdAt: new Date().toISOString() })
              const record = await syncSchedules()
              return json({ ok: true, reminder: record })
            }
            case 'remind.off': {
              const existing = reminderRecord(await readReminder())
              if (existing && schedule) {
                for (const id of Object.values(existing.times)) {
                  try { await schedule.edit({ id, action: 'delete' }) } catch { /* 可能已被手工删除 */ }
                }
              }
              await clearReminder()
              return json({ ok: true, reminder: null })
            }
            default:
              return json({ ok: false, error: { code: 'bad-action', message: `未知动作：${action}` } }, 400)
          }
        } catch (error) {
          return json({ ok: false, error: { code: 'dsh-reminder', message: String(error?.message ?? error) } }, 400)
        }

        if (['add', 'update', 'delete', 'done', 'undone', 'restore'].includes(action)) {
          await syncSchedules()
        }
        return json({ ok: true, today: today(), rows: buildRows(await store.list(), today()), ...extra })
      },
    }, 'dsh-reminder: items'), 'dsh-reminder: items route')
  })
}
