#!/bin/zsh
set -eu
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if curl -fsS http://127.0.0.1:4328/api/health 2>/dev/null | /usr/bin/grep -q 'jev2mcp'; then
 open http://127.0.0.1:4328
 exit 0
fi
export JEV_OPEN=1
if [[ -x "$HOME/.codex/skills/typesafe-ai/scripts/with-key" ]]; then
 exec "$HOME/.codex/skills/typesafe-ai/scripts/with-key" node src/server.mjs
fi
if [[ -z "${TYPESAFE_API_KEY:-}" ]]; then
 read -rs 'TYPESAFE_API_KEY?TypeSafe API key (hidden, kept only for this session): '
 echo
 export TYPESAFE_API_KEY
fi
exec node src/server.mjs
