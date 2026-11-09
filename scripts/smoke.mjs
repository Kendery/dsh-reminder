/**
 * 冒烟测试：把 src 复制到临时目录，用桩模块替代 @deepseek-ai/dsh-tools，
 * 验证 src/index.js 能加载、apply() 能注册出 6 个工具。
 *
 * 为什么复制：真实安装时，插件目录的 node_modules 里绝不能有假的 dsh-tools，
 * 否则会遮住宿主提供的真包。
 */

import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = new URL('..', import.meta.url).pathname
const dir = await mkdtemp(join(tmpdir(), 'dsh-jiri-smoke-'))

await cp(join(root, 'src'), join(dir, 'src'), { recursive: true })
// 运行时依赖也要带上，否则临时目录里解析不到 lunar-javascript
await cp(join(root, 'node_modules', 'lunar-javascript'), join(dir, 'node_modules', 'lunar-javascript'), { recursive: true })

const stubDir = join(dir, 'node_modules', '@deepseek-ai', 'dsh-tools')
await mkdir(stubDir, { recursive: true })
await writeFile(
  join(stubDir, 'package.json'),
  JSON.stringify({ name: '@deepseek-ai/dsh-tools', type: 'module', main: 'index.js' }),
)
await writeFile(join(stubDir, 'index.js'), 'export const defineTool = (definition) => definition\n')

const plugin = await import(pathToFileURL(join(dir, 'src', 'index.js')).href)
assert.equal(plugin.name, 'dsh-jiri', '插件名不对')
assert.deepEqual(plugin.inject, ['tools'], 'inject 应只依赖 tools')

const registered = []
const ctx = {
  tools: { register: (tool) => registered.push(tool) },
  logger: { info: () => {} },
  // 真实宿主里这两个是 cordis 的 API；冒烟只验证不会被调用崩
  inject: (_deps, callback) => callback({ get: () => undefined }),
  effect: (factory) => factory(),
}
plugin.apply(ctx, { file: join(dir, 'items.json') })

const names = registered.map((tool) => tool.name)
assert.deepEqual(
  names,
  ['jiri_add', 'jiri_list', 'jiri_done', 'jiri_update', 'jiri_delete', 'jiri_lunar', 'jiri_brief', 'jiri_reminders', 'jiri_export'],
  `注册的工具不对：${names.join(', ')}`,
)
for (const tool of registered) {
  assert.equal(typeof tool.execute, 'function', `${tool.name} 缺少 execute`)
  assert.ok(tool.description, `${tool.name} 缺少 description`)
  assert.ok(tool.output?.schema, `${tool.name} 缺少 output.schema`)
}

console.log(`[smoke] 插件 ${plugin.name} 加载成功，注册 ${registered.length} 个工具：${names.join(', ')}`)
