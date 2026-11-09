# dsh-jiri（记日）

> 把「按农历 / 按年 / 按周循环的日子」交给 agent 记住；页面上也能直接改。
> 领域逻辑移植自 Xcode 项目 **Reminder（记日）**，不是它的打包版。

## 现在有什么

| 模块 | 状态 | 说明 |
|---|---|---|
| `src/lunar.js` | ✅ | 公历 ⇄ 农历、闰月、腊月三十降级、反查下一次 |
| `src/repeat.js` | ✅ | 7 种重复规则展开（对齐 iOS 端 `RepeatKind`） |
| `src/store.js` | ✅ | JSON 存储，原子写 + 进程内串行化 |
| `src/tools.js` | ✅ | 6 个工具 |
| `src/index.js` | ✅ | 插件入口（`name` / `inject` / `apply`）+ 页面读写路由 |
| `src/client.js` | ✅ | 浏览器面：`main` 页面（增删改查）+ `sidebar.panellist` 图标，手写无构建 |
| 主动提醒 | ⬜ | 交给 DSH 内置 `schedule`，插件不自己造定时器 |

测试：**94 项**（农历 9 / 重复 15 / 工具与存储 12 / 服务 9 / 视图 6 / 黄历 5 / 导出 7 / 渲染 7）+ 2 个冒烟，全过。
渲染测试用真实 React 做 SSR（react 只装成 devDependency，不进发布包）。

**已端到端验证**（2026-11-07，桌面版 profile 热加载后由模型实际调用）：

```
jiri_lunar(2026-11-07)  → 2026-11-07 是 2026 年农历九月廿九
jiri_add(农历八月初八)  → 已记下，下一次 2027-09-08（305 天后）
jiri_list(upcoming)     → 表格里带「农历八月初八」
jiri_delete(id)         → 已删除，落盘文件回到空列表
```

## 六个工具

| 工具 | 作用 |
|---|---|
| `jiri_add` | 记一条（纪念日 / 待办 / 备忘），农历条目自动算下一次 |
| `jiri_list` | 查 today / upcoming / overdue / all |
| `jiri_done` | 标记某一次完成或跳过 |
| `jiri_update` | 改标题、日期、重复规则、标签、备注 |
| `jiri_delete` | 删 |
| `jiri_lunar` | 公历转农历，或农历反查公历 |
| `jiri_brief` | 今天到未来 N 天的简报 |
| `jiri_reminders` | 只返回今天该提醒的（提前点命中 + 今天到期），定时任务用 |
| `jiri_export` | 导出 json / markdown / ics 到指定路径 |

用起来就是一句话的事：

> 记一下我妈农历八月初八生日，提前三天提醒我。

## 数据

`$DSH_HOME/storages/dsh-jiri/items.json`（默认 `~/.dsh/...`），人可以直接打开看。

```jsonc
{
  "version": 1,
  "items": [{
    "id": "jiri_1a2b3c4d5e",
    "title": "妈妈的生日",
    "kind": "anniversary",
    "calendar": "lunar",
    "lunar": { "month": 8, "day": 8, "leap": false },
    "date": "2027-09-08",        // 公历锚点
    "repeat": "yearly",
    "done": [], "skipped": [],
    "tags": ["家人"]
  }]
}
```

## 跑测试

本机没有全局 node，用桌面版自带的 Electron 当 Node：

```sh
./scripts/test.sh    # 36 项单测
./scripts/smoke.mjs  # 入口冒烟（用 DSH node 跑，见下）
```

冒烟测试单独跑：

```sh
ELECTRON_RUN_AS_NODE=1 \
  "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" \
  scripts/smoke.mjs
```

## 一个刻意的例外：lunar-javascript

插件本体仍是零构建、纯 ESM，但老黄历的干支/节气/宜忌交给 `lunar-javascript`（纯 JS、无原生依赖）。
理由：干支纪日和节气自己推很容易差一天，与其写错，不如依赖一个成熟实现。

## 原本的零依赖部分

农历换算走 Node 内置的 `Intl.DateTimeFormat('zh-CN-u-ca-chinese')`，
和 iOS 端用 `Calendar(identifier: .chinese)` 是同一个思路：不自带万年历表。

实测覆盖：

| 场景 | 结果 |
|---|---|
| `2026-11-07` | 农历九月廿九 |
| `2025-08-01` | 农历**闰**六月初八 |
| `2027-02-06` | 腊月三十（属农历 2026 年） |
| `2027-02-07` | 正月初一（2027 春节） |
| 反查八月十五（从 2026-11-07 起） | `2027-09-15` |

## 三个必须记住的边界

1. `Intl` 只能「公历 → 农历」，**反查必须逐日扫描**（上限 400 天，毫秒级）。
2. 闰月以 `闰` 前缀出现（英文 locale 下是 `bis`），单独建模成 `leap: boolean`。
3. 农历腊月可能只有廿九；2 月 29 日生日在平年要降级 —— 由 `leapDayFallback` 决定。

## 安装

插件自带 `dsh.bundle`，装进 profile 后由 `dsh.profile.bundles` 自动挂载，**不用手改 cordis.patch.yml**：

```sh
# 1. 打包（file: 依赖会被 pnpm 装成软链，软链拿不到宿主 SDK，见下）
ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" \
  "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs" \
  pack --pack-destination ~/DSHwork

# 2. 装进目标 profile
dsh plugin --profile web add ~/DSHwork/dsh-jiri-0.1.2.tgz
```

桌面版（profile `desktop`）装完需要重启 App 才会生效。

### 踩过的坑：软链插件拿不到宿主 SDK

`@deepseek-ai/*` 不是从插件自己的 `node_modules` 解析的。加载器按模块路径分层
（`findInterceptionLayer`）：只有**位于 profile 目录树内**的模块才会被拦截解析到宿主包；
pnpm `file:` 依赖装出来是指向仓库的软链，落在 "linked" 层，走 Node 原生解析 → `ERR_MODULE_NOT_FOUND`。

所以本地开发要么用 tarball 安装，要么接受“改完要重新打包安装”。

另一个坑：`output.schema` 里的显式对象必须写 `additionalProperties`，否则 `defineTool` 直接抛
`JsonSchemaError`，插件在启动时被跳过（日志里是 `1 entry did not activate`）。


## 设计约束（来自方案文档）

- 插件跑在 Mac 上，**碰不到 iPhone**，所以不做推送。
- 第一版数据由插件独占，不读写 iOS App 的 SwiftData。
- 定位是「结构化长期数据 + 查询」，定时提醒交给 DSH 内置 `schedule`。

详见 [两项目转DSH插件-评估与方案.md](../两项目转DSH插件-评估与方案.md)。

## 页面（纪念日）

侧边栏面板里名为「纪念日」，点开是列表 + 表单：

| 能力 | 说明 |
|---|---|
| 新增 | 标题、类型（纪念日/待办/备忘）、公历/农历、农历月日与闰月、重复规则、标签 |
| 编辑 | 行内「编辑」回填表单，可改历法与农历分量（切到公历会丢掉 lunar） |
| 删除 | 带确认 |
| 打卡 | 标记这一次完成，列表里不再计入 |
| 重复规则 | 不重复 / 每年 / 每月 / 每周（选周几）/ 每天 / 单周 / 双周 / 每 N 天 |
| 月历 | 常驻在上方，与列表合并成一页；上下月、今天、点某天筛列表 |
| 彩色标记 | 每条记录按 id 哈希取调色板颜色，圆点与列表色条一致 |
| 老黄历（左栏） | 农历、干支、节气、建除十二神、宜/忌、彭祖百忌 |
| 黄历 · 续 | 冲煞、值神、**星宿、纳音、喜神/福神/财神方位**、吉时；展开看吉神宜趋与凶煞宜忌 |
| 星座·月相 | 星座、元素（火/土/风/水）、守护星、日期区间、传统月相 |
| 水星逆行 | 按水星地心视黄经算区间；月历上方横条显示当前/下次水逆，格子标「逆」 |
| 单双周 | 列表每行首列显示该日期所属 ISO 周的「单周/双周」 |
| 完成状态 | 打过卡的那一次显示为删除线 + 置灰，按钮变「撤销」 |
| 删除撤销 | 删除后右下角浮出「撤销」，可恢复被删记录 |
| 搜索筛选 | 按标题/标签搜索，标签一键筛选 |
| 表单定位 | 点编辑自动滚到表单 |
| 时区 | 页面右上选择，持久化到 settings.json，工具与页面共用 |
| 响应式 | 窗口 < 780px 自动紧凑：隐藏农历日、缩小格子、收起「距今」列 |
| 提醒时间 | 全局默认时刻 + 每条记录可覆盖；不同时刻各自对应一条定时任务，增删改后自动对齐 |
| 事件提醒 | 每条记录可设多个提前点（如 `7,1`）和**自己的提醒时刻**（如 20:30），按记录归属的时刻投递 |

数据链路：页面 → `POST /api/dsh-jiri/items`（`action: list|add|update|delete|done`）→ `src/service.js`（与工具共用校验）→ JSON 存储。

## 每日提醒

页面右上角「每日提醒」开关。打开后插件通过宿主的 `schedule` 服务创建一条每天 09:00 的任务
（`new_once`：首次投递新建会话，之后复用），投递内容就是让 agent 调 `jiri_brief`。
关掉会删除该任务；任务 id 记在 `~/.dsh/storages/dsh-jiri/reminder.json`。

## 导出 / 导入

- 页面右上「导出」：下载 JSON（备份）、Markdown、ICS 需走工具或路由
- `jiri_export` 工具可指定 `format` 与 `path`
- 「导入」接受本插件导出的 JSON，按 id 去重（重复的跳过），坏数据逐条报错但不中断

数据文件权限已改为 `0600`（此前是 0644，同机其他账户可读）。
