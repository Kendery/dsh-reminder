#!/bin/sh
# 本机没有全局 node，用 DSH 桌面版自带的 Electron 当 Node 跑测试。
set -e
cd "$(dirname "$0")/.."
NODE="${DSH_NODE:-/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness}"
ELECTRON_RUN_AS_NODE=1 "$NODE" --test test/*.test.js
