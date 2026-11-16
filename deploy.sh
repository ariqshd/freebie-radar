#!/bin/sh
# 部署脚本：先从 OpenBao 取管理员令牌，再重建容器。
# 密码只存在 OpenBao（secret/freebie-radar），本仓库、.env、docker inspect 均不含明文。
set -eu
cd "$(dirname "$0")"

DEPLOY_TOKEN_FILE="${BAO_DEPLOY_TOKEN_FILE:-$HOME/.config/openbao/deploy-token}"
[ -r "$DEPLOY_TOKEN_FILE" ] || { echo "missing $DEPLOY_TOKEN_FILE (scoped OpenBao deploy token)" >&2; exit 1; }

mkdir -p .secrets
BAO_ADDR="${BAO_ADDR:-http://127.0.0.1:8200}" \
BAO_TOKEN="$(cat "$DEPLOY_TOKEN_FILE")" \
  bao kv get -field=admin_token secret/freebie-radar > .secrets/admin_token
chmod 600 .secrets/admin_token
[ -s .secrets/admin_token ] || { echo "empty admin_token from vault" >&2; exit 1; }

docker compose --env-file .env up -d --build
echo "deployed; admin token came from OpenBao secret/freebie-radar"
