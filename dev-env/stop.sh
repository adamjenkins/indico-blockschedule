#!/usr/bin/env bash
# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

# Tear down the containers started by start.sh. Pass -v to also delete the
# Postgres data volume (full reset).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if podman compose version >/dev/null 2>&1; then
    podman compose down "$@"
elif command -v podman-compose >/dev/null 2>&1; then
    podman-compose down "$@"
else
    echo "Error: neither 'podman compose' nor 'podman-compose' is available." >&2
    exit 1
fi
