#!/usr/bin/env bash
set -euo pipefail
echo "==> 静态页:"
curl -sI http://106.75.145.60 | head -3
echo "==> API 反代:"
curl -s -o /dev/null -w "%{http_code}\n" http://106.75.145.60/api/health
