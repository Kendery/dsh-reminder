/**
 * 浏览器面冒烟：用桩 React + 桩 ModuleLoader 加载 client.js，
 * 验证它导出了 { name, inject, apply }，并且 apply 会往两个 slot 注册。
 */

import assert from 'node:assert/strict'

const registered = []

globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      class Component {
        constructor(props) { this.props = props; this.state = {} }
        setState(next) { this.state = Object.assign({}, this.state, next) }
      }
      const React = {
        createElement: () => null,
        useState: () => [null, () => {}],
        useEffect: () => {},
        useCallback: (fn) => fn,
        useRef: () => ({ current: null }),
        Component,
      }
      const mod = factory((specifier) => {
        if (specifier === 'react') return React
        throw new Error(`未预期的外部依赖：${specifier}`)
      })
      globalThis.__clientModule = { id, mod }
    },
  },
}

await import('../src/client.js')

const { id, mod } = globalThis.__clientModule
assert.equal(id, '@sunr/dsh-reminder')
assert.equal(mod.name, 'dsh-reminder')
assert.deepEqual(mod.inject, ['slots'])

const ctx = {
  slots: {
    inject: (_name, callback) => callback(),
    register: (spec, component) => registered.push({ spec, component }),
  },
}
mod.apply(ctx)

assert.equal(registered.length, 2, `应注册 2 个 slot，实际 ${registered.length}`)
const names = registered.map((entry) => entry.spec.name).sort()
assert.deepEqual(names, ['main', 'sidebar.panellist'])
assert.equal(registered.find((e) => e.spec.name === 'main').spec.key, 'dsh-reminder')
assert.equal(registered.find((e) => e.spec.name === 'sidebar.panellist').spec.id, 'dsh-reminder')
for (const entry of registered) assert.equal(typeof entry.component, 'function')

console.log('[client-smoke] 浏览器面加载成功，注册:', registered.map((e) => e.spec.name).join(', '))
