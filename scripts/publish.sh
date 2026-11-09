#!/bin/sh
# 发布到 npm：测试 → 干跑 → 真发。
# 优先使用 PATH 里的 npm（跨平台）；没有则用 DSH 自带的 pnpm。
set -e
cd "$(dirname "$0")/.."

NPMRC="$HOME/.npmrc"
if ! grep -qs 'registry.npmjs.org/:_authToken' "$NPMRC"; then
  echo "$NPMRC 里没有 npm 令牌，先按 PUBLISH.md 配置" >&2
  exit 1
fi

echo '== 1/3 测试 =='
./scripts/test.sh

if command -v npm >/dev/null 2>&1; then
  echo '== 2/3 干跑 =='
  npm publish --dry-run --access public
  echo '== 3/3 发布 =='
  npm publish --access public "$@"
else
  NODE="${DSH_NODE:-/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness}"
  PNPM="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"
  echo '== 2/3 干跑 =='
  ELECTRON_RUN_AS_NODE=1 "$NODE" "$PNPM" publish --dry-run --no-git-checks --access public
  echo '== 3/3 发布 =='
  ELECTRON_RUN_AS_NODE=1 "$NODE" "$PNPM" publish --no-git-checks --access public "$@"
fi
