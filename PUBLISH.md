# 发布到 npm

> 已确认：`@sunr/dsh-reminder` 在 npm 上未被占用；包内容 39KB，只含 `src/`、`bundles/`、`locale/`、`README.md`。

## 一次性配置

1. 登录 <https://www.npmjs.com> → 右上头像 → **Access Tokens** → **Generate New Token** → *Granular Access Token*
2. 填写：
   - Name：`@sunr/dsh-reminder-publish`
   - Expiration：90 天（到期再换）
   - **Permissions: Read and write**
   - **勾选 “Bypass two-factor authentication”**（否则每次发布要输 6 位动态码）
   - Packages and scopes：All packages（或只勾 `@sunr/dsh-reminder`）
3. 复制生成的 `npm_...`，追加到 `~/.npmrc`（**不要覆盖已有内容**）：

```sh
echo '//registry.npmjs.org/:_authToken=npm_你的令牌' >> ~/.npmrc
chmod 600 ~/.npmrc
```

## 发布

```sh
cd ~/DSHwork/@sunr/dsh-reminder
./scripts/publish.sh
```

脚本会依次：跑全部测试 → `publish --dry-run` 看一遍要发什么 → 真正发布。

手动等价命令（本机没有全局 node，用 DSH 自带的 pnpm）：

```sh
N="/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"
P="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"
ELECTRON_RUN_AS_NODE=1 "$N" "$P" publish --no-git-checks
```

## 发布后验证

```sh
curl -s https://registry.npmjs.org/@sunr/dsh-reminder | head -c 200     # 应返回 JSON
dsh plugin --profile desktop add @sunr/dsh-reminder                     # 从 registry 安装
```

装完重启桌面版，确认工具和页面还在（数据不受影响，仍在 `~/.dsh/storages/@sunr/dsh-reminder/`）。

## 更新流程

```sh
# 1. 改代码
# 2. 升版本（语义化：修 bug 打补丁、加功能升次版本）
python3 - <<'EOF'
import json, pathlib
p = pathlib.Path('package.json'); d = json.loads(p.read_text())
v = d['version'].split('.')
d['version'] = f'{v[0]}.{v[1]}.{int(v[2]) + 1}'
p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
print(d['version'])
EOF
# 3. ./scripts/publish.sh
# 4. 用户侧升级
dsh plugin --profile desktop update @sunr/dsh-reminder@latest
```

## 注意

- **同一版本号只能发一次**，失败重试前先升版本。
- 发布 **72 小时后不可撤回**，包名基本永久占用。
- 令牌等同密码：不要提交进 git，不要贴到聊天里，泄露立刻在 npmjs.com 撤销。
- 国内直连 `registry.npmjs.org` 可能不稳；发布必须用官方源，镜像只能用于安装。

## 常见报错

| 报错 | 原因 | 处理 |
|---|---|---|
| `401 Unauthorized`（`/-/whoami` 也 401） | 令牌无效或复制不完整 | 重新生成，用 Copy 按钮 |
| `404 Not Found - PUT` | 令牌无效时 npm 的伪装响应 | 同上，先验证 whoami |
| **`E_STAGE_REQUIRED`** | granular 令牌只能发到暂存区，新包必须由“可直接发布”的令牌创建 | 改用 **Classic Token → Automation**，或 `npm publish --otp=xxxxxx` |
| `EOTP` | 令牌未勾 bypass 2FA | 重生成令牌，或改用动态码发布 |
| `EPUBLISHCONFLICT` | 该版本已存在 | 升版本后重发 |
| `E403`（非 stage 提示） | 权限不足或包名被占 | 检查令牌权限/包名 |
