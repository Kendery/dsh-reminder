# 发布到 npm

> 已确认：`dsh-jiri` 在 npm 上未被占用；包内容 39KB，只含 `src/`、`bundles/`、`locale/`、`README.md`。

## 一次性配置

1. 登录 <https://www.npmjs.com> → 右上头像 → **Access Tokens** → **Generate New Token** → *Granular Access Token*
2. 填写：
   - Name：`dsh-jiri-publish`
   - Expiration：90 天（到期再换）
   - **Permissions: Read and write**
   - **勾选 “Bypass two-factor authentication”**（否则每次发布要输 6 位动态码）
   - Packages and scopes：All packages（或只勾 `dsh-jiri`）
3. 复制生成的 `npm_...`，追加到 `~/.npmrc`（**不要覆盖已有内容**）：

```sh
echo '//registry.npmjs.org/:_authToken=npm_你的令牌' >> ~/.npmrc
chmod 600 ~/.npmrc
```

## 发布

```sh
cd ~/DSHwork/dsh-jiri
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
curl -s https://registry.npmjs.org/dsh-jiri | head -c 200     # 应返回 JSON
dsh plugin --profile desktop add dsh-jiri                     # 从 registry 安装
```

装完重启桌面版，确认工具和页面还在（数据不受影响，仍在 `~/.dsh/storages/dsh-jiri/`）。

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
dsh plugin --profile desktop update dsh-jiri@latest
```

## 注意

- **同一版本号只能发一次**，失败重试前先升版本。
- 发布 **72 小时后不可撤回**，包名基本永久占用。
- 令牌等同密码：不要提交进 git，不要贴到聊天里，泄露立刻在 npmjs.com 撤销。
- 国内直连 `registry.npmjs.org` 可能不稳；发布必须用官方源，镜像只能用于安装。
