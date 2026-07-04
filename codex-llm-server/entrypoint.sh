#!/usr/bin/env sh
# Boot the Codex-backed OpenAI-compatible server.
#
# Two secrets are required (set them as Railway service variables):
#   CODEX_AUTH_JSON  contents of your ~/.codex/auth.json (the ChatGPT Codex login)
#   LLM_API_KEY      bearer key clients must present (also set on the web service
#                    as DCE_LLM_API_KEY)
#
# The server validates the Codex auth on startup and EXITS before binding the port
# if it is missing / not a Codex auth file / expired without a usable refresh
# token — Railway's restart policy will surface that in the logs.
set -eu

: "${CODEX_AUTH_JSON:?Set CODEX_AUTH_JSON to the contents of your ~/.codex/auth.json}"
: "${LLM_API_KEY:?Set LLM_API_KEY — the bearer key clients must present}"

# Materialise the Codex credentials to a file the server can read. Never bake them
# into the image; they only ever live in this ephemeral file at runtime.
AUTH_FILE="${CODEX_AUTH_JSON_PATH:-/tmp/codex-auth.json}"
umask 077
printf '%s' "$CODEX_AUTH_JSON" > "$AUTH_FILE"

# Bind :: (all IPv6) by default: Railway private networking resolves
# <service>.railway.internal over IPv6, so an IPv4-only bind is unreachable.
# Override with LLM_HOST=0.0.0.0 only if you deliberately expose it publicly.
exec openai-api-server-via-codex serve \
  --host "${LLM_HOST:-::}" \
  --port "${PORT:-18080}" \
  --api-key "${LLM_API_KEY}" \
  --auth-json "$AUTH_FILE"
