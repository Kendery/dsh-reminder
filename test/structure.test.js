/**
 * 渲染树结构回归测试。
 *
 * 起因：用脚本按位置改 JSX 时，缩进/切片出错会让某个卡片从渲染树里消失，
 * 而语法检查和组件级 SSR 都发现不了（组件本身是好的，只是没人渲染它）。
 * 这里直接检查 Page 的渲染体里确实实例化了这些组件。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')

function pageBody() {
  const start = source.indexOf('function Page() {')
  assert.ok(start > 0, 'Page 函数定位失败')
  // Page 是文件里最后一个组件，截到 __test 导出之前
  const end = source.indexOf('module.exports.__test', start)
  return source.slice(start, end === -1 ? undefined : end)
}

const REQUIRED = [
  ['CalendarGrid', '月历'],
  ['MercuryStrip', '水逆横条'],
  ['AlmanacCard', '老黄历'],
  ['ZodiacCard', '星座·月相'],
  ['Form', '编辑表单'],
]

for (const [component, label] of REQUIRED) {
  test(`渲染树包含 ${label}（${component}）`, () => {
    const body = pageBody()
    const pattern = new RegExp(`h\\(${component},`)
    assert.match(body, pattern, `${component} 没有出现在 Page 的渲染树里`)
  })
}

test('渲染树里不再引用已删除的组件', () => {
  const body = pageBody()
  assert.doesNotMatch(body, /h\(CompactList,/)
})
