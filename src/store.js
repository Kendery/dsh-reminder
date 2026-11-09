/**
 * 存储层：一个 JSON 文件，原子写（临时文件 + rename），进程内串行化。
 *
 * 为什么不用 DSH 的 storage-domain：第一版要能脱离宿主单测，
 * 也要能让人直接打开文件看数据。等形态稳定了再迁到 ctx.storage。
 */

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const SCHEMA_VERSION = 1

export function defaultStorePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'storages', 'dsh-jiri', 'items.json')
}

export function emptyState() {
  return { version: SCHEMA_VERSION, items: [] }
}

export function newId() {
  return `jiri_${randomBytes(5).toString('hex')}`
}

/** 串行化读-改-写，避免并发工具调用互相覆盖 */
function createQueue() {
  let tail = Promise.resolve()
  return (task) => {
    const run = tail.then(task, task)
    tail = run.then(() => undefined, () => undefined)
    return run
  }
}

export async function readState(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.items)) throw new Error(`存储格式不对：${file}`)
    return { version: parsed.version ?? SCHEMA_VERSION, items: parsed.items }
  } catch (error) {
    if (error.code === 'ENOENT') return emptyState()
    throw error
  }
}

export async function writeState(file, state) {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  // 记录里有生日、家庭关系，只给当前用户读
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temp, file)
  await chmod(file, 0o600).catch(() => {})
}

export function createStore(file = defaultStorePath()) {
  const enqueue = createQueue()

  return {
    file,

    async list() {
      return (await readState(file)).items
    },

    async get(id) {
      const items = await readState(file)
      return items.items.find((item) => item.id === id) ?? null
    },

    async insert(item) {
      return enqueue(async () => {
        const state = await readState(file)
        state.items.push(item)
        await writeState(file, state)
        return item
      })
    },

    async patch(id, fields) {
      return enqueue(async () => {
        const state = await readState(file)
        const index = state.items.findIndex((item) => item.id === id)
        if (index === -1) return null
        const merged = { ...state.items[index], ...fields, id, updatedAt: new Date().toISOString() }
        state.items[index] = merged
        await writeState(file, state)
        return merged
      })
    },

    async remove(id) {
      return enqueue(async () => {
        const state = await readState(file)
        const index = state.items.findIndex((item) => item.id === id)
        if (index === -1) return null
        const [removed] = state.items.splice(index, 1)
        await writeState(file, state)
        return removed
      })
    },

    /** 直接改整个 state 的逃生门：导入、迁移用 */
    async mutate(mutator) {
      return enqueue(async () => {
        const state = await readState(file)
        const result = await mutator(state)
        await writeState(file, state)
        return result
      })
    },
  }
}
