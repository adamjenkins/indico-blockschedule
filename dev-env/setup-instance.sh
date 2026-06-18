#!/usr/bin/env bash
# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

# setup-instance.sh — Bootstrap a full, publicly-reachable Indico dev instance:
# Postgres/redis (podman), a Python 3.12 venv with Indico (+ this plugin, if
# run from inside one) installed, frontend assets built, a systemd unit to
# keep it running, and (optionally) an nginx reverse-proxy location added to
# an existing vhost. Safe to re-run — existing config/DB/unit are left alone
# unless you remove them first.
#
# Run this from indipda/ itself (for a bare Indico instance with no plugin),
# or from inside a plugin scaffolded by ../new-plugin.sh (it'll detect and
# install the plugin automatically).
#
# All paths/domain/etc. are asked interactively on first run. To automate
# (CI, repeat installs), export the corresponding variable beforehand and
# the prompt for it is skipped — see the `ask_*` calls below for the full
# list of variable names.
#
# What this does:
#   0. Asks for the Indico core checkout path, public domain, public port,
#      and systemd service name (skipped for any already-exported vars)
#   1. Installs system packages needed to build/run Indico (libpq-dev,
#      build-essential, podman, podman-compose, and the uidmap/passt/
#      netavark/aardvark-dns rootless-podman networking deps)
#   2. Installs uv and a Python 3.12 interpreter via it
#   3. Creates a venv in the Indico checkout and installs Indico (editable,
#      [dev]) plus this plugin too, if one is detected in the working
#      directory's pyproject.toml
#   4. Runs npm ci in the Indico checkout for frontend build tooling
#   5. Starts the Postgres + redis containers via ./start.sh
#   6. Writes indico.conf (skipped if it already exists) and runs
#      `indico db prepare` only on first-time setup; enables the detected
#      plugin in PLUGINS if not already listed
#   7. Compiles translations and builds webpack assets for Indico core
#      (and the plugin, if it has its own webpack-bundles.json)
#   8. Installs + enables a systemd unit that starts the dev server on
#      boot, with the containers as a prerequisite step
#   9. Optionally adds an nginx server block for $PUBLIC_PORT to an
#      existing vhost for the domain, reusing its TLS cert if found
#      (skipped if no such vhost is found, or if already present)
#
# Requires: sudo access, network access (to fetch uv/Python/npm packages).
# nginx integration requires an existing vhost for the domain with TLS
# already configured if you want HTTPS — this script does not provision
# certificates.
#
# Indico is deliberately served at the *domain root*, never under a URL
# subpath: every React-managed page (timetable, contributions, sessions,
# etc.) makes AJAX calls whose paths are baked at webpack build time via
# the `indico-url:` system, with no runtime prefix-awareness, and the only
# flag that could fix that (build-assets.py --url-root) breaks the CSS
# build for fonts/images instead (an upstream resolve-url-loader bug - see
# .prompts/core/local-dev-environment.md for the full writeup). So if the
# vhost for $DOMAIN already serves something else at its default ports,
# this script gives Indico its own dedicated $PUBLIC_PORT on the same
# vhost/cert instead of trying to coexist via a subpath.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="$(dirname "$SCRIPT_DIR")"

# ── 0. Gather configuration ──────────────────────────────────────────────────
ask_required() {
    local var="$1" prompt="$2"
    [ -n "${!var:-}" ] && return
    if [ -t 0 ]; then
        local input=""
        while [ -z "$input" ]; do
            read -rp "$prompt: " input
            [ -z "$input" ] && echo "  (required)"
        done
        printf -v "$var" '%s' "$input"
    else
        echo "Error: \$$var is required - set it as an env var before running non-interactively." >&2
        exit 1
    fi
}

ask_default() {
    local var="$1" prompt="$2" default="$3"
    [ -n "${!var+x}" ] && return   # respects an intentionally-empty exported value
    if [ -t 0 ]; then
        local input
        read -rp "$prompt [$default]: " input
        printf -v "$var" '%s' "${input:-$default}"
    else
        printf -v "$var" '%s' "$default"
    fi
}

echo "==> [0/9] Configuration"

detected_indico_src=""
for cand in "$WORKDIR/../indico" "$WORKDIR/../../indico"; do
    if [ -f "$cand/pyproject.toml" ]; then
        detected_indico_src="$(cd "$cand" && pwd)"
        break
    fi
done
if [ -n "$detected_indico_src" ]; then
    ask_default INDICO_SRC "Indico core checkout path" "$detected_indico_src"
else
    ask_required INDICO_SRC "Indico core checkout path (no ../indico or ../../indico found)"
fi
if [ ! -f "$INDICO_SRC/pyproject.toml" ]; then
    echo "Error: $INDICO_SRC/pyproject.toml not found - not an Indico checkout." >&2
    exit 1
fi

ask_required DOMAIN "Public domain Indico will be served on (e.g. indico.example.com)"
ask_default SERVICE_NAME "systemd service name" "indico-dev"
ask_default BIND_HOST "Local bind address for the dev server" "127.0.0.1"
ask_default BIND_PORT "Local bind port for the dev server" "8000"

default_nginx_conf="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$default_nginx_conf" ]; then
    ask_default SETUP_NGINX "Add an nginx server block to $default_nginx_conf? (yes/no)" "yes"
else
    ask_default SETUP_NGINX "No existing nginx vhost found at $default_nginx_conf - configure nginx anyway? (yes/no)" "no"
fi
if [ "$SETUP_NGINX" = "yes" ]; then
    ask_default NGINX_CONF "nginx vhost file to edit" "$default_nginx_conf"
    ask_default PUBLIC_PORT \
        "Public HTTPS port for Indico (use a dedicated one if $DOMAIN already serves something else at 443; Indico always runs at the domain root, never a subpath - see script header)" \
        "8443"
fi

PG_PORT="${INDIPDA_PG_PORT:-15432}"
REDIS_PORT="${INDIPDA_REDIS_PORT:-16379}"
DATA_ROOT="$WORKDIR/data"
CONFIG_PATH="$INDICO_SRC/indico/indico.conf"
INDICO_URL="https://$DOMAIN"
[ "${PUBLIC_PORT:-443}" != "443" ] && INDICO_URL="$INDICO_URL:$PUBLIC_PORT"

export PATH="$HOME/.local/bin:$PATH"

# Detect a plugin in $WORKDIR (i.e. this script was copied into a plugin
# scaffolded by new-plugin.sh, not run from bare indipda/).
PLUGIN_NAMES=""
if [ -f "$WORKDIR/pyproject.toml" ]; then
    PLUGIN_NAMES="$(python3 - "$WORKDIR/pyproject.toml" <<'PYEOF'
import sys
import tomllib

with open(sys.argv[1], 'rb') as f:
    data = tomllib.load(f)
eps = data.get('project', {}).get('entry-points', {}).get('indico.plugins', {})
print(' '.join(eps.keys()))
PYEOF
)"
fi
if [ -n "$PLUGIN_NAMES" ]; then
    echo "    Detected plugin entry point(s) in $WORKDIR/pyproject.toml: $PLUGIN_NAMES"
fi

# ── 1. System packages ───────────────────────────────────────────────────────
# build-essential (not just gcc) is needed for psycopg2's source build to find
# libc headers (stdlib.h etc). uidmap/passt/netavark/aardvark-dns are required
# for rootless podman to start containers at all - without them `podman compose
# up` fails with "newuidmap: executable file not found" or "setting up Pasta:
# ... pasta: executable file not found", even though podman/podman-compose
# themselves are installed and look fine.
echo "==> [1/9] Installing system packages (libpq-dev, build-essential, podman + rootless networking deps)..."
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
    libpq-dev build-essential podman podman-compose uidmap passt netavark aardvark-dns

# ── 2. uv + Python 3.12 ──────────────────────────────────────────────────────
echo "==> [2/9] Checking uv + Python 3.12..."
if ! command -v uv >/dev/null; then
    echo "    Installing uv..."
    curl -fsSL https://astral.sh/uv/install.sh | sh
fi
uv python install 3.12

# ── 3. Venv + Indico (+ plugin) install ──────────────────────────────────────
echo "==> [3/9] Creating venv and installing Indico (editable, [dev])..."
cd "$INDICO_SRC"
[ -d .venv ] || uv venv --python=3.12 .venv
source .venv/bin/activate
uv pip install -e '.[dev]'
if [ -n "$PLUGIN_NAMES" ]; then
    echo "    Installing plugin from $WORKDIR..."
    uv pip install -e "$WORKDIR"
fi

# ── 4. Frontend dependencies ─────────────────────────────────────────────────
echo "==> [4/9] Installing npm dependencies (this may take a minute)..."
npm ci

# ── 5. Postgres + redis containers ───────────────────────────────────────────
echo "==> [5/9] Starting Postgres + redis via podman..."
"$SCRIPT_DIR/start.sh"

# ── 6. Configure + initialize the database ───────────────────────────────────
echo "==> [6/9] Configuring Indico..."
if [ -f "$CONFIG_PATH" ]; then
    echo "    $CONFIG_PATH already exists, leaving it (and the DB) alone."
    echo "    Delete it and run './stop.sh -v' first for a clean re-init."
else
    mkdir -p "$DATA_ROOT"/{archive,cache,log,tmp}
    cp "$INDICO_SRC/indico/logging.yaml.sample" "$INDICO_SRC/indico/logging.yaml"
    python3 - "$CONFIG_PATH" "$DATA_ROOT" "$INDICO_URL" "$PG_PORT" "$REDIS_PORT" <<'PYEOF'
import os
import sys

config_path, data_root, indico_url, pg_port, redis_port = sys.argv[1:6]
secret = repr(os.urandom(32))
storage_backends = {'default': 'fs:' + os.path.join(data_root, 'archive')}

config_data = [
    '# General settings',
    f"SQLALCHEMY_DATABASE_URI = 'postgresql://indico:indico@localhost:{pg_port}/indico'",
    f'SECRET_KEY = {secret}',
    f"BASE_URL = {indico_url!r}",
    f"CELERY_BROKER = 'redis://localhost:{redis_port}/1'",
    f"REDIS_CACHE_URL = 'redis://localhost:{redis_port}/0'",
    "DEFAULT_TIMEZONE = 'UTC'",
    "DEFAULT_LOCALE = 'en_GB'",
    "ENABLE_ROOMBOOKING = False",
    f"CACHE_DIR = {os.path.join(data_root, 'cache')!r}",
    f"TEMP_DIR = {os.path.join(data_root, 'tmp')!r}",
    f"LOG_DIR = {os.path.join(data_root, 'log')!r}",
    "LOCAL_PASSWORD_MIN_LENGTH = 15",
    "CSP_ENABLED = True",
    f"STORAGE_BACKENDS = {storage_backends!r}",
    "ATTACHMENT_STORAGE = 'default'",
    '',
    '# Email settings (no real SMTP server in this sandbox)',
    "SMTP_SERVER = ('127.0.0.1', 1025)",
    "SMTP_USE_TLS = False",
    "SMTP_LOGIN = ''",
    "SMTP_PASSWORD = ''",
    "SUPPORT_EMAIL = 'admin@example.com'",
    "PUBLIC_SUPPORT_EMAIL = ''",
    "NO_REPLY_EMAIL = 'noreply@example.com'",
    '',
    '# Development options',
    'DB_LOG = True',
    'DEBUG = True',
    'SMTP_USE_CELERY = False',
]
with open(config_path, 'w') as f:
    f.write('\n'.join(config_data) + '\n')
print(f'wrote {config_path}')
PYEOF
    echo "    Running indico db prepare..."
    INDICO_CONFIG="$CONFIG_PATH" indico db prepare
fi

if [ -n "$PLUGIN_NAMES" ]; then
    PLUGINS_LINE="PLUGINS = {$(python3 -c "print(', '.join(repr(p) for p in '''$PLUGIN_NAMES'''.split()))")}"
    if ! grep -qF "$PLUGINS_LINE" "$CONFIG_PATH" 2>/dev/null; then
        printf '\n# Enabled plugins (added by setup-instance.sh)\n%s\n' "$PLUGINS_LINE" >> "$CONFIG_PATH"
        echo "    Added to $CONFIG_PATH: $PLUGINS_LINE"
    fi
fi

# ── 7. Translations + frontend assets ────────────────────────────────────────
# Built with the default url-root ("/") since Indico is always served at the
# domain root (see script header) - --url-root is only needed for subpath
# deployments, which we deliberately avoid.
echo "==> [7/9] Compiling translations and building webpack assets..."
INDICO_CONFIG="$CONFIG_PATH" indico i18n compile indico || true  # a few non-English locales have known upstream po errors; en_GB is unaffected
NODE_OPTIONS="--max-old-space-size=3072" ./bin/maintenance/build-assets.py indico --dev
if [ -n "$PLUGIN_NAMES" ] && [ -f "$WORKDIR/webpack-bundles.json" ]; then
    echo "    Building plugin assets..."
    NODE_OPTIONS="--max-old-space-size=3072" ./bin/maintenance/build-assets.py plugin "$WORKDIR" --dev
fi

# ── 8. systemd unit ───────────────────────────────────────────────────────────
echo "==> [8/9] Installing systemd unit ($SERVICE_NAME.service)..."
sudo loginctl enable-linger "$(whoami)"   # keeps the user runtime dir available for rootless podman at boot, before any login
sudo pkill -u "$(whoami)" -f "indico run -h $BIND_HOST -p $BIND_PORT" 2>/dev/null || true  # stop any manually-started instance
UNIT_PATH="/etc/systemd/system/$SERVICE_NAME.service"
sudo tee "$UNIT_PATH" > /dev/null <<EOF
[Unit]
Description=Indico dev server ($SERVICE_NAME, NOT for production)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(whoami)
Group=$(id -gn)

# Required for the rootless podman containers (started by ExecStartPre) to
# work from a system-level unit. Requires \`loginctl enable-linger $(whoami)\`
# (done above) so the user's runtime dir exists even before any login.
Environment=XDG_RUNTIME_DIR=/run/user/$(id -u)

Environment=INDICO_CONFIG=$CONFIG_PATH
Environment=PATH=$INDICO_SRC/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

WorkingDirectory=$INDICO_SRC

# Idempotent - brings up (or confirms) the Postgres/redis containers before
# the dev server tries to connect to them.
ExecStartPre=$SCRIPT_DIR/start.sh

ExecStart=$INDICO_SRC/.venv/bin/indico run -h $BIND_HOST -p $BIND_PORT --url $INDICO_URL --proxy -q --reloader none

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME.service"
sudo systemctl restart "$SERVICE_NAME.service"
sleep 3
sudo systemctl --no-pager status "$SERVICE_NAME.service" || true

# ── 9. nginx ──────────────────────────────────────────────────────────────────
# Adds a dedicated server block listening on $PUBLIC_PORT, proxying to the
# dev server at the domain root - never a subpath (see script header for
# why). Reuses whatever ssl_certificate/ssl_certificate_key lines are found
# in the existing vhost file, if any; otherwise falls back to plain HTTP.
# Leaves the existing vhost's own server block(s) completely untouched, so
# it keeps serving whatever else it was serving before.
echo "==> [9/9] Configuring nginx..."
if [ "$SETUP_NGINX" != "yes" ]; then
    echo "    Skipped (not requested or no existing vhost found)."
    echo "    The dev server is reachable directly at http://$BIND_HOST:$BIND_PORT/"
elif sudo grep -qF "listen $PUBLIC_PORT" "$NGINX_CONF" 2>/dev/null; then
    echo "    $NGINX_CONF already has a server block on port $PUBLIC_PORT, skipping."
else
    sudo cp "$NGINX_CONF" "$NGINX_CONF.bak-$(date +%Y%m%d%H%M%S)"
    sudo python3 - "$NGINX_CONF" "$DOMAIN" "$PUBLIC_PORT" "$BIND_HOST" "$BIND_PORT" <<'PYEOF'
import re
import sys

path, domain, public_port, bind_host, bind_port = sys.argv[1:6]
with open(path) as f:
    content = f.read()

cert = re.search(r'^\s*ssl_certificate\s+(\S+);', content, re.MULTILINE)
cert_key = re.search(r'^\s*ssl_certificate_key\s+(\S+);', content, re.MULTILINE)
if cert and cert_key:
    ssl_lines = (
        f'\tlisten {public_port} ssl;\n'
        f'\tlisten [::]:{public_port} ssl;\n'
        f'\tssl_certificate     {cert.group(1)};\n'
        f'\tssl_certificate_key {cert_key.group(1)};\n'
    )
else:
    ssl_lines = f'\tlisten {public_port};\n\tlisten [::]:{public_port};\n'

block = f'''
# Indico dev instance (indipda), proxied to the local dev server. Given its
# own dedicated port (rather than a location under this vhost) because
# Indico's React-managed pages bake AJAX URLs at build time with no
# awareness of a subpath - see .prompts/core/local-dev-environment.md in
# indipda for the full writeup of why a subpath deployment doesn't work.
server {{
{ssl_lines}\tserver_name {domain};

\tlocation / {{
\t\tproxy_pass http://{bind_host}:{bind_port};
\t\tproxy_http_version 1.1;
\t\tproxy_set_header Host $host;
\t\tproxy_set_header X-Real-IP $remote_addr;
\t\tproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
\t\tproxy_set_header X-Forwarded-Proto $scheme;
\t\tproxy_read_timeout 300s;
\t\tclient_max_body_size 1G;
\t}}
}}
'''

with open(path, 'a') as f:
    f.write(block)
PYEOF
    sudo nginx -t
    sudo systemctl reload nginx
fi

echo
echo "Done. Indico should be reachable at $INDICO_URL"
echo "Logs: sudo journalctl -u $SERVICE_NAME -f"
