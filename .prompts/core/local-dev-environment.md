# Local Dev Environment for Manual Testing

`.prompts/core/ci-validation.md` covers automated checks (ruff, isort,
pytest). This file covers getting a real, running Indico instance with
the plugin installed, for manual click-through testing — the step CI
checks alone can't replace (see `verify`/`run` skills and the project
guidance that UI changes need to be exercised in a real browser).

**Shortcut**: `dev-env/setup-instance.sh` automates everything below
(containers, venv, Indico + plugin install, asset build, a systemd unit,
and an optional nginx location) and is safe to re-run. It asks for the
Indico checkout path, domain, and URL prefix on first run. Read on if you
want to do it by hand, or to understand/troubleshoot what the script is
doing.

## 1. Start Postgres + redis (podman)

```bash
cd dev-env && ./start.sh
```

This provisions Postgres (with the `unaccent`/`pg_trgm` extensions Indico
requires, plus a separate `indico_test` database) and redis as
containers, and prints the env vars to export. See `dev-env/README.md`
for details and `INDIPDA_PG_PORT`/`INDIPDA_REDIS_PORT` overrides if the
defaults collide with something else.

If podman isn't available, fall back to a native install per
`../../indico/docs/source/installation/development.rst` ("Installing
System Packages" / "Creating the DB") — the rest of this guide is
identical either way once Postgres/redis are reachable.

## 2. Python environment + Indico

```bash
uv venv --python=3.12 .venv      # or python3.12 -m venv .venv
source .venv/bin/activate

# Indico core — editable install from the reference checkout if you have
# one (../../indico or ../indico), otherwise from PyPI/git per Indico's
# own install docs.
uv pip install -e ../../indico'[dev]'
(cd ../../indico && npm ci)

# The plugin itself, from this plugin's own directory
uv pip install -e .
```

## 3. Configure and initialize

```bash
indico setup wizard --dev
```

When the wizard asks for the database URI and cache/broker URLs, use the
values `dev-env/start.sh` printed (`SQLALCHEMY_DATABASE_URI`,
`REDIS_CACHE_URL`, `CELERY_BROKER`). Then:

```bash
indico db prepare
indico i18n compile indico
```

Enable the plugin by adding its short name (the key under
`[project.entry-points.'indico.plugins']` in `pyproject.toml`) to
`PLUGINS` in the generated `indico.conf`.

## 4. Run it

Two long-running processes, in separate shells:

```bash
# Core asset watcher (only needed if you're touching indico core itself)
../../indico/bin/maintenance/build-assets.py indico --dev --watch

# Plugin asset watcher — needed if the plugin has its own webpack-bundles.json
../../indico/bin/maintenance/build-assets.py plugin . --dev --watch

# The dev server itself
indico run -h 127.0.0.1 -p 8000 -q --enable-evalex
```

Indico is now reachable at `http://127.0.0.1:8000` with the plugin
loaded. Confirm with `indico setup list-plugins`.

## 5. Tear down

```bash
deactivate                 # leave the venv
cd dev-env && ./stop.sh    # or ./stop.sh -v to also wipe the DB volume
```

## Notes

- This is a from-scratch flow. If a Postgres data volume already exists
  from a previous session (`./stop.sh` without `-v`), skip `indico db
  prepare` only if you're confident the schema is still compatible —
  otherwise wipe with `./stop.sh -v` and start clean.
- `INDICO_TEST_DATABASE_URI` (pointing at the container's `indico_test`
  database) can be exported alongside the above so `pytest` reuses the
  same Postgres instance instead of spinning up its own temporary one —
  see `.prompts/core/ci-validation.md`. `redis-server` for pytest still
  needs to be a binary on `PATH`, independent of the redis container.
- On a memory-constrained host, the one-shot `build-assets.py` webpack
  build can hit Node's default heap limit and crash with "Reached heap
  limit Allocation failed". Set
  `NODE_OPTIONS="--max-old-space-size=3072"` (or higher, up to what the
  host can spare) before running it. Confirmed needed on a ~2 GB VM with
  swap.

## Exposing the dev server through a reverse proxy

**Do not deploy under a URL subpath (e.g. `/indico`) if you need any of the
React-based management pages to work** (timetable, contributions, sessions,
registration, etc. management — anything using AJAX rather than full page
loads). Use a dedicated port or subdomain at the domain root instead. See
"Subpath deployment is a dead end" below for why; the short version is that
it's not just an nginx-rewrite problem like the `/dist/` quirk, it's an
upstream Indico build bug with no workaround short of patching core.

### Root-domain deployment (recommended)

```bash
indico run -h 127.0.0.1 -p 8000 --url https://yourdomain.example --proxy -q --reloader none
```

`--proxy` enables `ProxyFix` so the app trusts `X-Forwarded-Proto`/
`X-Forwarded-For`/`Host` from one upstream hop (required for the `https://`
URL to be detected correctly behind a TLS-terminating nginx). With no path
component in `--url`, there's no `DispatcherMiddleware` wrapping and no
prefix mismatch of any kind — every asset and AJAX endpoint just works.

nginx side is a single, trivial proxy block:

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If the domain's `:80`/`:443` are already in use by something else (e.g. a
shared vhost serving another app), put this `server {}` block on its own
port (`listen 8443 ssl;` etc., reusing the same domain/cert) rather than
trying to share the vhost via a subpath. `setup-instance.sh` always does
this (asking for `PUBLIC_PORT`, default `8443`) when nginx integration is
requested — see the script for the exact mechanism, including how it
auto-detects and reuses the existing vhost's `ssl_certificate`/
`ssl_certificate_key` lines.

### Subpath deployment is a dead end

This was tried first (mounting at `/indico` via `indico run --url
.../indico --proxy` + an `nginx location ^~ /indico`, forwarding the full
original URI since the app's `DispatcherMiddleware` strips the prefix
internally) and three *separate* bugs were found, each requiring more
nginx-side patching than the last, before hitting one with no nginx-side
fix at all:

1. Webpack-built asset URLs from the manifest (`/dist/...`) are emitted
   root-absolute regardless of the `--url` prefix (a `flask-webpackext`
   limitation) — fixable with an extra `location ^~ /dist/` rewrite to
   `http://127.0.0.1:8000/indico/dist/`.
2. Webfonts/icons (icomoon, Roboto, etc.) and other images are served
   straight from Flask's `static_folder` at `static_url_path='/'` (the
   app's root, not under `/dist/`), and those CSS `url(...)` references are
   *also* root-absolute (`/fonts/...`, `/images/...`) — fixable the same
   way, with `location ^~ /fonts/` and `location ^~ /images/` rewrites.

   Tempting "real" fix for both 1 and 2: `build-assets.py --url-root
   /indico`, which exists for exactly this. **Don't.** It breaks the build
   outright: `postcss-url` rewrites `static:images/foo.gif` to the
   root-relative URL `/indico/images/foo.gif` first, then
   `resolve-url-loader` (configured with `root: <staticPath>`, only for
   core builds — plugin builds set `root: false` and don't hit this) sees
   that root-relative URL and resolves it *again* against the static
   folder on disk, landing on `<staticPath>/indico/images/foo.gif` — the
   prefix gets misread as a real subdirectory and the build fails with
   `Can't resolve '.../web/static/indico/images/loading.gif'` for every
   scss file referencing a font or image.
3. **No nginx fix exists for this one.** Every React-based management page
   (timetable, contributions, sessions, etc.) makes AJAX calls built via
   the `indico-url:` babel-plugin-flask-urls import system
   (`webpack-plugin-flask-urls`/`babel.config.js`), which bakes the full
   request path — including the prefix — at *build* time from
   `webpack-build-config.json`'s `build.baseURLPath` (itself set from
   `build-assets.py`'s `--url-root`). Built at the default `--url-root`
   (the only way to get a working CSS build, per point 2), every single
   one of these AJAX calls goes out **missing the `/indico` prefix
   entirely** (e.g. `/event/4/manage/contributions/published` instead of
   `/indico/event/4/manage/contributions/published`), 404s against
   whatever else is on that path at the vhost root, and the action silently
   fails (confirmed via the "publish contributions" toggle — it just spins
   forever / the page shows a generic "Something went wrong" toast). There
   is no finite, enumerable set of nginx locations to add here — it's
   potentially every management endpoint in the app. The only real fixes
   are patching `webpack/base.mjs`'s `postCSSURLResolver` (it bakes
   `baseURLPath` into the value handed to `resolve-url-loader` for disk
   resolution, when that prefixing should happen later, at
   `indicoStaticLoader`'s `publicPath` stage, which already does it
   correctly) or abandoning the subpath. Since `../indico` is a read-only
   reference checkout (see `AGENTS.md` — never modify it), root-domain
   deployment is the only viable option here.

**Security note**: don't pass `--enable-evalex` when exposing the dev
server beyond localhost — it activates Werkzeug's interactive debugger
console, which is a remote-code-execution risk if reachable by anyone
untrusted. `DEBUG = True` in `indico.conf` (set by `--dev`-style configs)
will still show tracebacks on errors; that's a lesser but real
information-disclosure risk too, fine for a throwaway/internal dev
instance, not for anything with real data or external reachability.
