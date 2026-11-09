#!/bin/sh
# 交互式写入 npm 令牌到 ~/.npmrc：先向 registry 验证，再落盘。
set -e

NPMRC="$HOME/.npmrc"

printf 'npm token（npm_ 开头，粘贴后回车）: '
stty -echo 2>/dev/null || true
read -r TOKEN
stty echo 2>/dev/null || true
printf '\n\n'

TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
case "$TOKEN" in
  npm_*) ;;
  *) echo '看起来不是 npm 令牌（应以 npm_ 开头）' >&2; exit 1 ;;
esac
echo "令牌长度：${#TOKEN}"

printf '验证中… '
BODY=$(mktemp)
CODE=$(curl -s -o "$BODY" -w '%{http_code}' -H "Authorization: Bearer $TOKEN" https://registry.npmjs.org/-/whoami || echo 000)
if [ "$CODE" != "200" ]; then
  printf '失败（HTTP %s）\n' "$CODE"
  echo '令牌无效：请在 npmjs.com 重新生成（Access Tokens → Generate New Token）。' >&2
  echo '注意只复制 npm_ 开头的那一串，不要带页面上的其他文字。' >&2
  rm -f "$BODY"
  exit 1
fi
printf '通过，账号：%s\n' "$(sed -e 's/[{}"]//g' -e 's/username://' "$BODY")"
rm -f "$BODY"

[ -f "$NPMRC" ] && cp "$NPMRC" "$NPMRC.bak.$(date +%s)"

# 删除旧的 registry 令牌行（如果有），再追加新的
if [ -f "$NPMRC" ]; then
  grep -v 'registry.npmjs.org/:_authToken' "$NPMRC" > "$NPMRC.tmp" || true
  mv "$NPMRC.tmp" "$NPMRC"
fi
printf '//registry.npmjs.org/:_authToken=%s\n' "$TOKEN" >> "$NPMRC"
chmod 600 "$NPMRC"

echo "已写入 $NPMRC（权限 600，旧文件已备份为 .bak.*）"
echo '下一步：./scripts/publish.sh'
