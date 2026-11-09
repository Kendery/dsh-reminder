# 记日插件 · 双机工作流（macOS ⇄ Windows）

> 适用版本：`@sunr/dsh-reminder@0.14.x`
> 仓库：<https://github.com/Kendery/dsh-reminder>
> 更新日期：2026-11-09

---

## 0. 一页速查

| 我想做的事 | 在哪台机器 | 跑什么 |
|---|---|---|
| 改代码 | macOS（主） | `cd ~/DSHwork/dsh-jiri && npm test` |
| 看改动效果（不发版） | macOS | `npm pack` → `dsh plugin add ./xxx.tgz` |
| 发新版本 | macOS | 升版本 → `./scripts/publish.sh` |
| 升级另一台机器 | Windows | `dsh plugin --profile desktop add "@sunr/dsh-reminder@^x.y.z"` |
| 带走数据 | 任意 | 页面「导出」→ 传文件 → 另一台「导入」 |
| 开每日提醒 | 每台各自 | 页面右上「每日提醒」开关 |

---

## 1. 资产清单

| 资产 | 位置 |
|---|---|
| 源码 | macOS：`~/DSHwork/dsh-jiri`（git 仓库，`main` 分支） |
| 远程仓库 | <https://github.com/Kendery/dsh-reminder> |
| npm 包 | <https://www.npmjs.com/package/@sunr/dsh-reminder> |
| 数据（记录） | macOS `~/.dsh/storages/dsh-reminder/items.json`<br>Windows `%USERPROFILE%\.dsh\storages\dsh-reminder\items.json` |
| 设置（时区/提醒时间） | 同目录 `settings.json` |
| 提醒任务映射 | 同目录 `reminder.json` |
| 发布令牌 | `~/.npmrc` / `%USERPROFILE%\.npmrc` |

---

## 2. 环境对照

| 项 | macOS | Windows |
|---|---|---|
| Node | `~/DSHwork/tools/node/bin`（便携版 26.13） | 官方安装包，或 DSH 自带 `node.exe` |
| npm | 同上 | 随 Node |
| DSH CLI | `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh` | `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd` |
| 插件安装目录 | `~/.dsh/profiles/desktop/node_modules/@sunr/dsh-reminder/` | `%USERPROFILE%\.dsh\profiles\desktop\node_modules\@sunr\dsh-reminder\` |
| 工作目录 | `~/DSHwork/dsh-jiri` | 任意，建议 `%USERPROFILE%\DSHwork\dsh-reminder` |

**共同点**：插件本体没有平台相关代码（依赖都是纯 JS），所以两边跑的是同一份代码。

---

## 3. macOS：日常开发

### 3.1 拉最新 + 定义变量

```sh
cd ~/DSHwork/dsh-jiri
git pull

# 让 node/npm 可用（便携版）
export PATH="$HOME/DSHwork/tools/node/bin:$PATH"

# 后面命令里用到的 $DSH_CLI
export DSH_CLI="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
```

> 如果 `dsh` 已经在 PATH 里，上面最后一行可以省略，把 `"$DSH_CLI"` 换成 `dsh` 即可。

### 3.2 改代码

```
src/lunar.js      农历换算
src/repeat.js     重复规则
src/almanac.js    老黄历、星座、月相
src/retrograde.js 水逆区间
src/view.js       列表/月历数据投影
src/service.js    写入校验（工具与页面共用）
src/store.js      JSON 存储
src/tools.js      9 个模型工具
src/index.js      插件入口 + 页面路由 + 提醒任务
src/client.js     浏览器面（手写 CJS，无构建）
```

### 3.3 跑测试

```sh
npm test          # = node --test，101 项 + 结构测试
```

改了 `client.js` 还要跑冒烟（验证模块能加载、注册出组件）：

```sh
export PATH="$HOME/DSHwork/tools/node/bin:$PATH"
node scripts/client-smoke.mjs
```

### 3.4 不发版看效果

```sh
npm pack                                    # 生成 sunr-dsh-reminder-x.y.z.tgz
"$DSH_CLI" plugin --profile desktop add ./sunr-dsh-reminder-x.y.z.tgz
```

装完**退出重开桌面端**（客户端 bundle 在启动时加载）。

想更快的话，直接改 profile 里的副本（不推荐，下次安装会被覆盖）：

```sh
~/.dsh/profiles/desktop/node_modules/@sunr/dsh-reminder/src/client.js
```

### 3.5 提交

```sh
git add -A
git commit -m "feat: 一句话说明"
git push
```

---

## 4. macOS：发布版本

### 4.1 升版本（语义化）

| 改动类型 | 版本位 |
|---|---|
| 修 bug、调样式 | 补丁位 `0.14.3 → 0.14.4` |
| 加功能 | 次版本 `0.14.4 → 0.15.0` |
| 破坏性改动（数据结构、工具参数） | 主版本 `0.x → 1.0.0` |

```sh
python3 - <<'EOF'
import json, pathlib
p = pathlib.Path('package.json'); d = json.loads(p.read_text())
v = d['version'].split('.')
d['version'] = f'{v[0]}.{v[1]}.{int(v[2]) + 1}'
p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
print(d['version'])
EOF
```

### 4.2 发布

```sh
./scripts/publish.sh        # 测试 → 干跑 → 发布
```

或手动：

```sh
npm publish --access public
```

### 4.3 等它真正可用

npm 发布后要过内容扫描，约 1–5 分钟。**别马上装**，先轮询：

```sh
for i in $(seq 1 10); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://registry.npmjs.org/@sunr%2Fdsh-reminder/0.14.4")
  echo "0.14.4 → $CODE"; [ "$CODE" = "200" ] && break; sleep 15
done
```

### 4.4 更新本机 + 另一台

```sh
"$DSH_CLI" plugin --profile desktop add "@sunr/dsh-reminder@^0.14.4"
```

> ⚠️ `dsh plugin update` **不会**真的升版本（实测过），必须用 `add @^x.y.z`。

### 4.5 打 tag（可选）

```sh
git tag v0.14.4 && git push --tags
```

---

## 5. Windows：首次安装

### 5.1 装 DSH

要求 **≥ 0.2.0-rc.2**。当前那台是 `0.2.1-rc.5`，刚好在范围内（0.14.1 起已放宽）。

### 5.2 装插件

**图形界面**：插件页 → Add plugin → 搜 `@sunr/dsh-reminder` → Install

**命令行**：

```powershell
dsh plugin --profile desktop add "@sunr/dsh-reminder@^0.14.3"
```

`dsh` 不在 PATH 时用完整路径：

```
%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd
```

装完重启桌面端，侧边栏出现「记日」。

### 5.3 导数据（可选）

1. macOS：记日页面 → **导出** → 得到 `jiri-YYYY-MM-DD.json`
2. 传到 Windows
3. Windows：记日页面 → **导入** → 选文件（按 id 去重）

### 5.4 开每日提醒

页面右上「每日提醒」开关。**每台机器独立**，不会同步。

---

## 6. Windows：开发（可选）

### 6.1 准备

```powershell
# 装 Node 22.19+ 或 24+（官网 msi），然后确认
node -v
npm -v
```

### 6.2 拉代码

```powershell
git clone git@github.com:Kendery/dsh-reminder.git dsh-reminder
cd dsh-reminder
npm install
npm test
```

### 6.3 本地联调

```powershell
npm pack
dsh plugin --profile desktop add .\sunr-dsh-reminder-0.14.3.tgz
```

### 6.4 发布（Windows 也能发）

```
%USERPROFILE%\.npmrc 里写：
//registry.npmjs.org/:_authToken=npm_xxx
```

```powershell
npm publish --access public
```

---

## 7. 数据与提醒的边界

| 东西 | 会同步吗 | 说明 |
|---|---|---|
| 记录的日期/标题/标签 | ❌ | 存本机 JSON，需手动导出/导入 |
| 时区、提醒时间 | ❌ | `settings.json` 本机 |
| 每日提醒任务 | ❌ | 宿主 `schedule` 的任务，本机 |
| 插件代码 | ✅ | 走 npm / git |

想真正双机同步，得做云端（CloudKit / 自建 API），目前没做。

---

## 8. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 安装提示 `engines.dsh` 不兼容 | DSH 版本低于包声明 | 升级 DSH，或 `dsh plugin allow-version <pkg@ver> --dsh-version <ver> --accept-risk` |
| `E_STAGE_REQUIRED` | 令牌没有「publish and stage」或没勾 Bypass 2FA | 重新生成令牌 |
| 发布后 `npm view` 404 | 还在内容扫描 | 等 1–5 分钟再查 |
| `latest` 指向 `0.0.0-stage` | 首次发布产生的占位包 | `npm dist-tag add <包>@<版本> latest` |
| `dsh plugin update` 没效果 | 该命令不升版本 | 用 `add "@pkg@^x.y.z"` |
| 页面空白 | 客户端渲染抛错 | 0.13.1 起有错误边界，会显示红字原因 |
| 卡片消失 | 渲染树里漏了组件 | `npm test` 的 structure 测试会拦 |
| GitHub SSH 断连 | 代理没转发 22 端口 | 换全局代理，或改用 HTTPS |
| LibreSSL 握手失败 | 代理 TLS 不稳定 | 重试；或 `git -c http.sslBackend=secure-transport` |

---

## 9. 版本记录

| 版本 | 内容 |
|---|---|
| 0.13.x | 月历/列表合并、水逆、星座、两栏布局 |
| 0.14.0 | 包名改为 `@sunr/dsh-reminder`，数据目录自动迁移 |
| 0.14.1 | `engines.dsh` 放宽到 `>=0.2.0-rc.2`（兼容 0.2.1） |
| 0.14.2 | 列表增加「星期」列 |
| 0.14.3 | 补 `repository` / `homepage` / `bugs`，npm 页面显示源码链接 |

---

## 10. 已知限制

1. **不能显示在系统桌面**：插件跑在 DSH 的 Web UI 里，没有创建桌面小组件/菜单栏的 API。要做需要外部程序（macOS SwiftBar、Windows Rainmeter）或自己写原生应用。
2. **数据不自动同步**：两台机器各存一份，靠导出/导入。
3. **提醒依赖宿主常开**：DSH 关着时，到点的任务不会投递。
4. **`engines` 放宽未实测**：0.14.1 声明的 `>=0.2.0-rc.2` 是基于 API 等价性推断，没有在 0.2.1 上跑过完整回归。
