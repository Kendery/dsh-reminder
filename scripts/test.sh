#!/bin/sh
# 跨平台跑测试：优先用 PATH 里的 node，其次用 DSH 桌面版自带的 Electron。
set -e
cd "$(dirname "$0")/.."

if [ -n "$DSH_NODE" ]; then
  NODE="$DSH_NODE"
elif command -v node >/dev/null 2>&1; then
  NODE=node
elif [ -x "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" ]; then
  NODE="/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"
else
  echo '找不到 Node：装一个 Node 22+，或设置 DSH_NODE 指向可执行文件' >&2
  exit 1
fi

if [ "$NODE" = "node" ]; then
  "$NODE" --test
else
  ELECTRON_RUN_AS_NODE=1 "$NODE" --test
fi
