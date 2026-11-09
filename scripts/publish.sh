#!/bin/sh
# 发布到 npm：先跑测试与干跑，再真正发布。
# 前置：~/.npmrc 里有 //registry.npmjs.org/:_authToken=npm_...
set -e
cd "$(dirname "$0")/.."

NODE="${DSH_NODE:-/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness}"
PNPM="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"

if [ ! -f "$NODE" ]; then
  echo "找不到 DSH 的 Node：$NODE" >&2
  echo "可以设置 DSH_NODE 指向任意 Node 22+ 可执行文件" >&2
  exit 1
fi

if ! grep -qs 'registry.npmjs.org/:_authToken' "$HOME/.npmrc"; then
  echo "~/.npmrc 里没有 npm 令牌，先按 PUBLISH.md 配置" >&2
  exit 1
fi

echo "== 1/3 测试 =="
ELECTRON_RUN_AS_NODE=1 "$NODE" --test test/*.test.js

echo "== 2/3 干跑 =="
ELECTRON_RUN_AS_NODE=1 "$NODE" "$PNPM" publish --dry-run --no-git-checks

echo "== 3/3 发布 =="
ELECTRON_RUN_AS_NODE=1 "$NODE" "$PNPM" publish --no-git-checks "$@"
