#!/bin/sh
# Container entrypoint: start bundled FalkorDB (unless pointed at FalkorDB Cloud), seed if empty, serve.
set -e

if [ "$FALKORDB_HOST" = "127.0.0.1" ] || [ "$FALKORDB_HOST" = "localhost" ]; then
  mkdir -p "$FALKORDB_DATA_PATH"
  redis-server --protected-mode yes --bind 127.0.0.1 --port "$FALKORDB_PORT" \
    --dir "$FALKORDB_DATA_PATH" --appendonly yes --appendfsync everysec \
    --loadmodule "$FALKORDB_BIN_PATH/falkordb.so" $FALKORDB_ARGS \
    --daemonize yes
  until redis-cli -p "$FALKORDB_PORT" ping >/dev/null 2>&1; do sleep 0.2; done
fi

# Seed the synthetic course on first boot (or every boot with RESEED=1).
/venv/bin/python - <<'EOF'
import os
from app import db
from scripts import seed
try:
    n = db.ro("MATCH (c:Concept) RETURN count(c) AS n")[0]["n"]
except Exception:
    n = 0
if n == 0 or os.getenv("RESEED") == "1":
    seed.main()
else:
    print(f"Graph already has {n} concepts, skipping seed.")
EOF

exec /venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers --forwarded-allow-ips="*"
