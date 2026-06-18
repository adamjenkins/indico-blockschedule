#!/usr/bin/env bash
# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

# Bring up Postgres + redis containers (via podman) for manually testing an
# Indico plugin against a real dev server. Does NOT run Indico itself —
# see ../.prompts/core/local-dev-environment.md for the full workflow.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

compose() {
    if podman compose version >/dev/null 2>&1; then
        podman compose "$@"
    elif command -v podman-compose >/dev/null 2>&1; then
        podman-compose "$@"
    else
        echo "Error: neither 'podman compose' nor 'podman-compose' is available." >&2
        echo "Install podman-compose, or use a podman version with the 'compose' subcommand." >&2
        exit 1
    fi
}

compose up -d

echo "Waiting for postgres and redis to become healthy..."
pg_status=starting
redis_status=starting
for _ in $(seq 1 30); do
    pg_status=$(podman inspect --format '{{.State.Health.Status}}' indipda-postgres 2>/dev/null || echo starting)
    redis_status=$(podman inspect --format '{{.State.Health.Status}}' indipda-redis 2>/dev/null || echo starting)
    [ "$pg_status" = "healthy" ] && [ "$redis_status" = "healthy" ] && break
    sleep 1
done

if [ "$pg_status" != "healthy" ] || [ "$redis_status" != "healthy" ]; then
    echo "Warning: containers did not report healthy in time (postgres=$pg_status, redis=$redis_status)." >&2
    echo "Check 'podman logs indipda-postgres' / 'podman logs indipda-redis'." >&2
fi

PG_PORT="${INDIPDA_PG_PORT:-15432}"
REDIS_PORT="${INDIPDA_REDIS_PORT:-16379}"

cat <<EOF

Containers are up. Export these in the shell where you'll run Indico
(or append the export lines to a .env.local and 'source' it — see
dev-env/README.md):

    export SQLALCHEMY_DATABASE_URI="postgresql://indico:indico@localhost:${PG_PORT}/indico"
    export INDICO_TEST_DATABASE_URI="postgresql://indico:indico@localhost:${PG_PORT}/indico_test"
    export REDIS_CACHE_URL="redis://localhost:${REDIS_PORT}/0"
    export CELERY_BROKER="redis://localhost:${REDIS_PORT}/1"

Note: pytest still needs its own 'redis-server' binary on PATH (it spawns a
short-lived instance per test session via pytest-redis) — this container's
redis is for the manually-running 'indico run' dev server, not for pytest.
EOF
