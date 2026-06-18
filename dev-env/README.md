# dev-env — Postgres + redis via podman

A minimal podman-based dev environment for manually testing an Indico
plugin against a real running Indico instance. It provisions **just**
Postgres and redis as containers; Indico itself, its Python venv, and the
plugin under test run natively on your machine (so editable installs,
debuggers, and webpack watchers work normally).

For the full workflow (creating the venv, installing Indico + the plugin,
running the dev server), see
[`../.prompts/core/local-dev-environment.md`](../.prompts/core/local-dev-environment.md).
This README only covers the containers themselves.

## Requirements

- [podman](https://podman.io/) installed, with either the `podman compose`
  subcommand (podman 4.something+) or the standalone `podman-compose` tool.
- For rootless podman (the default), the `uidmap` package (provides
  `newuidmap`/`newgidmap`) and the `passt` package (provides `pasta`, used
  for rootless container networking) must also be installed - without them
  `start.sh` fails with `newuidmap: executable file not found` or
  `setting up Pasta: ... pasta: executable file not found`, even though
  `podman`/`podman-compose` themselves are present and look fine.
  `netavark`/`aardvark-dns` are usually pulled in as podman dependencies
  already; install them explicitly if not. `setup-instance.sh` installs all
  of these automatically.

## Quickstart

```bash
./start.sh
```

This brings up two containers:

| Container | Purpose | Default host port |
|---|---|---|
| `indipda-postgres` | Postgres 16, with `unaccent`/`pg_trgm` extensions pre-created in both an `indico` database (for the dev server) and a separate `indico_test` database (for `INDICO_TEST_DATABASE_URI`) | `15432` |
| `indipda-redis` | redis 7, used as Indico's cache backend and Celery broker while the dev server is running | `16379` |

`start.sh` waits for both to report healthy, then prints the exact
`export` lines to use in the shell where you'll run Indico. Override the
host ports with `INDIPDA_PG_PORT`/`INDIPDA_REDIS_PORT` if they collide
with something else already running.

To stop:

```bash
./stop.sh        # stop containers, keep the Postgres data volume
./stop.sh -v     # stop containers and wipe the data volume (full reset)
```

## What this does *not* do

- It doesn't install or run Indico itself, build assets, or wire up a
  systemd unit / nginx — see `setup-instance.sh` below for that, or
  `../.prompts/core/local-dev-environment.md` for the fully manual
  walkthrough.
- It doesn't satisfy pytest's redis requirement — `pytest-redis` spawns
  its own short-lived `redis-server` process per test session and needs
  the `redis-server` *binary* on `PATH`, not a running service. This
  container's redis is for the manually-running dev server only. Postgres
  is different: pytest's `INDICO_TEST_DATABASE_URI` can point straight at
  this container's `indico_test` database.

## setup-instance.sh — the rest of the stack, automated

`./setup-instance.sh` goes further than the containers above: it
provisions a full, optionally publicly-reachable Indico dev instance —
Python 3.12 venv (via `uv`), Indico installed editable, this plugin
installed too (auto-detected from a `pyproject.toml` in the parent
directory, if run from inside a plugin scaffolded by `../new-plugin.sh`),
frontend assets built, a systemd unit to keep it running (and survive
reboots), and an optional dedicated nginx server block on an existing
vhost's domain/cert.

It's interactive — it asks for the Indico core checkout path, public
domain, public port, and systemd service name on first run (export the
matching variable beforehand to skip any given prompt; see the script's
header comment for the full list). Safe to re-run: an existing
`indico.conf`/database/nginx block is left alone.

```bash
./setup-instance.sh
```

Indico is always served at the domain root, on its own port if the vhost
is already serving something else — never under a URL subpath. See
`../.prompts/core/local-dev-environment.md` for why (short version: a
subpath breaks AJAX calls in every React-managed admin page, with no nginx
workaround, due to an upstream build-time URL-baking bug) and for the
nginx/systemd mechanics if you want to understand or troubleshoot what
this script is doing.

## populate-dummy-data.py — quick test data for manual testing

Once an event exists (created via the UI), `populate-dummy-data.py` fills
it with a description and five dummy contributions (scheduled back to back
from the event's start time), useful for testing UI flows that need
existing content - e.g. publishing the contribution list, exporting, the
timetable view, etc.

```bash
cd /path/to/indico/checkout
source .venv/bin/activate
INDICO_CONFIG=/path/to/indico.conf python3 /path/to/indipda/dev-env/populate-dummy-data.py <event_id> [actor_email]
```

`actor_email` (optional) sets who the created-by/changed-by log entries are
attributed to; defaults to the first admin user found. Run it as a
standalone script rather than piping into `indico shell` - see the
docstring at the top of the file for why (the interactive shell hangs
silently on multi-line blocks like `for` loops piped via stdin).

## Persisting your environment variables

`start.sh` only prints the export lines; it doesn't write them anywhere.
If you want them to persist across shells, capture them once:

```bash
./start.sh | tee /dev/stderr | grep '^    export' | sed 's/^ *//' > .env.local
source .env.local
```

`.env.local` is gitignored (see the root `.gitignore`) since it's
machine-specific and not meant to be committed.

## Troubleshooting

- **Stray anonymous volume after `stop.sh -v`**: some `podman-compose`
  versions leave behind an unrelated anonymous volume alongside the named
  `indipda-pgdata` one (which *is* removed correctly). Safe to clean up
  with `podman volume prune`.
- **Port already in use**: set `INDIPDA_PG_PORT`/`INDIPDA_REDIS_PORT` to
  free ports before running `start.sh`.

