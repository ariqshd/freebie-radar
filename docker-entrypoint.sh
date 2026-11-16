#!/bin/sh
# 启动时从 Docker secret 读取管理员令牌。
# 密码只存于 OpenBao（secret/freebie-radar），不落 .env、不进 git、不进 docker inspect。
set -eu

SECRET_FILE="/run/secrets/admin_token"

if [ -r "$SECRET_FILE" ]; then
  ADMIN_TOKEN="$(tr -d '\n\r' < "$SECRET_FILE")"
  export ADMIN_TOKEN
  echo "[entrypoint] admin token loaded from vault-backed secret"
elif [ -n "${ADMIN_TOKEN:-}" ]; then
  echo "[entrypoint] WARNING: using ADMIN_TOKEN from environment (legacy fallback)"
else
  echo "[entrypoint] ERROR: /run/secrets/admin_token missing and no ADMIN_TOKEN env" >&2
  echo "[entrypoint] run ./deploy.sh — it fetches the secret from OpenBao first" >&2
  exit 1
fi

exec "$@"
