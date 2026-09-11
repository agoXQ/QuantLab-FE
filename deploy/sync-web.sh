#!/usr/bin/env bash
# 构建前端并发布到服务器 nginx
set -euo pipefail

# 定位到本仓库根目录 (deploy/ 的上一级), 从任何地方跑都行
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="ucloud"
REMOTE_DIR="/opt/quantlab/web/dist"
URL="http://106.75.145.60"

cd "$PROJECT_ROOT"

if [ ! -d node_modules ]; then
  echo "==> npm install"
  npm install
fi

echo "==> npm run build"
npm run build

if [ ! -f dist/index.html ]; then
  echo "!! 构建产物异常: dist/index.html 不存在" >&2
  exit 1
fi

echo "==> 发布到 $REMOTE:$REMOTE_DIR"
ssh "$REMOTE" "mkdir -p $REMOTE_DIR"
rsync -avz --delete dist/ "$REMOTE:$REMOTE_DIR/"

echo "==> 完成: $URL"
