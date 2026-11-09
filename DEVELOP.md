# 跨机器开发

> 插件源码在 `~/DSHwork/dsh-jiri`（macOS），没有构建步骤——纯 ESM，改完直接能跑。

## 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node | 22.19+ 或 24+ | 跑测试、打包、发布。Windows 可装官方安装包，或使用 DSH 自带的 `node.exe` |
| npm | 随 Node 附带 | `npm install` / `npm test` / `npm pack` / `npm publish` |
| git | 任意（可选） | 只在用 bundle 克隆时需要 |
| DSH 桌面版 | ≥ 0.2.0-rc.2 | 插件宿主 |

## 从另一台机器恢复源码

**方式一：git bundle（推荐，带完整历史）**

```sh
git clone dsh-reminder.bundle dsh-reminder
cd dsh-reminder
```

用 bundle 克隆后，原仓库的提交历史都在；想推到 GitHub 也只要 `git remote add origin ...`。

**方式二：zip（没有 git 也能用）**

解压 `dsh-reminder-src.zip` 即可，但只有当前快照、没有历史。

## 安装依赖

```sh
npm install
```

会装 `lunar-javascript`、`astronomy-engine`（运行时依赖）和 `react`、`react-dom`（仅测试用，不打进包）。

## 跑测试

```sh
npm test          # 等价于 node --test
```

Windows PowerShell 直接用 `npm test` 就行。`./scripts/test.sh` 需要 POSIX shell（Git Bash / WSL），它会自动找 Node：优先 `PATH` 里的 `node`，其次 macOS 的 DSH 自带 Electron，可用 `DSH_NODE` 覆盖。

## 本地联调（不发版）

```sh
npm pack                                  # 生成 sunr-dsh-reminder-x.y.z.tgz
dsh plugin --profile desktop add ./sunr-dsh-reminder-x.y.z.tgz
```

改完代码重新 pack + add 即可，版本号不变也能覆盖安装。

## 发布

```sh
./scripts/publish.sh      # 测试 → 干跑 → 发布
# 或
npm publish --access public
```

前置：`~/.npmrc`（Windows 是 `%USERPROFILE%\.npmrc`）里有

```
//registry.npmjs.org/:_authToken=npm_xxx
```

令牌需要 **Bypass 2FA**，否则发布会掉进暂存区。

## 平台差异备忘

| 项 | macOS | Windows |
|---|---|---|
| DSH CLI | `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh` | `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd` |
| 数据目录 | `~/.dsh/storages/dsh-reminder/` | `%USERPROFILE%\.dsh\storages\dsh-reminder\` |
| 插件安装目录 | `~/.dsh/profiles/desktop/node_modules/@sunr/dsh-reminder/` | `%USERPROFILE%\.dsh\profiles\desktop\node_modules\@sunr\dsh-reminder\` |

插件本身没有平台相关代码（依赖都是纯 JS），路径差异只影响你找文件。

## 别提交的东西

`.gitignore` 已经排除 `node_modules/`、`*.tgz`、`.DS_Store`。发布包由 `package.json` 的 `files` 决定，只含 `src/`、`bundles/`、`locale/`、`README.md`。
