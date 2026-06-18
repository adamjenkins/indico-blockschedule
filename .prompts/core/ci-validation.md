# Indico Plugin Quality Standards

## Overview

Before declaring any task complete, you MUST run the checks below that are
actually available in this environment, and resolve every failure they
report (or explicitly tell the user why one was skipped). There is no
`MOODLE_DIR`-style pre-built test instance for Indico in this environment —
checks run against the plugin's own checkout plus a local Python venv.

## Environment detection

```bash
# Indico core checkout (read-only reference, also needed for `pip install -e`
# of indico itself in some setups)
for cand in ../indico ../../indico "$INDICO_DIR"; do
    [ -n "$cand" ] && [ -f "$cand/setup.cfg" -o -f "$cand/pyproject.toml" ] && INDICO_CORE_DIR="$cand" && break
done

# Official plugin collection (for comparing patterns, not required for CI)
for cand in ../indico-plugins ../../indico-plugins "$INDICO_PLUGINS_DIR"; do
    [ -n "$cand" ] && [ -d "$cand" ] && INDICO_PLUGINS_DIR="$cand" && break
done

# Is the plugin installed in editable mode in the active venv?
python -c "import indico" 2>/dev/null && INDICO_IMPORTABLE=true || INDICO_IMPORTABLE=false

# Postgres / redis available for pytest?
command -v redis-server >/dev/null && REDIS_AVAILABLE=true || REDIS_AVAILABLE=false
[ -n "$INDICO_TEST_DATABASE_URI" ] && POSTGRES_CONFIGURED=true || POSTGRES_CONFIGURED=false
```

If `INDICO_TEST_DATABASE_URI` isn't set and `dev-env/start.sh` has been
run (or could be), it provides a ready-made `indico_test` database —
`export INDICO_TEST_DATABASE_URI="postgresql://indico:indico@localhost:${INDIPDA_PG_PORT:-15432}/indico_test"`
before running `pytest`. This doesn't substitute for `redis-server` on
`PATH`, which pytest needs regardless (see `.prompts/core/local-dev-environment.md`).

Report which of these resolved before running anything — if `INDICO_IMPORTABLE`
is false, most checks below besides `ruff`/`isort` will fail for unrelated
reasons (missing `indico` package), and you should say so rather than
treating every failure as a code bug.

## MANDATORY checks — always run for any code change

1. **Ruff lint** ✅ ALWAYS RUN
   ```bash
   ruff check .
   ```
   Config comes from this plugin's `ruff.toml` (copy from a reference
   plugin in `$INDICO_PLUGINS_DIR` if missing — don't invent one). Fix
   every reported issue; `ruff check --fix .` handles most automatically.

2. **Import order** ✅ ALWAYS RUN
   ```bash
   isort --check-only .
   ```
   Action on failure: `isort .`, then re-check.

3. **License header** ✅ ALWAYS RUN (if `unbehead` is installed)
   ```bash
   unbehead --check
   ```
   Skip with a note to the user if `unbehead` isn't installed in the venv.

4. **Python syntax sanity** ✅ ALWAYS RUN
   ```bash
   python -m py_compile $(git ls-files '*.py')
   ```
   Cheap backstop in case ruff is misconfigured.

## CONDITIONAL — requires INDICO_IMPORTABLE=true

5. **Plugin loads cleanly**
   ```bash
   python -c "from indico_<pluginname>.plugin import *"
   ```
   Catches import-time errors (missing dependency, bad signal wiring)
   before they surface as a 500 at runtime.

6. **PHPUnit-equivalent: pytest** ⚠️ RUN if Postgres + redis are available
   ```bash
   pytest
   ```
   Requires `pytest.ini` with `indico_plugins = <pluginname>` and
   `python_files = *_test.py` (not `test_*.py` — Indico's pytest plugin
   convention). Needs `INDICO_TEST_DATABASE_URI` pointing at a Postgres
   instance and `redis-server` on `PATH`. If either is missing, SKIP and
   tell the user exactly what's missing and how the official CI sets it
   up (`indico-plugins/.github/workflows/ci.yml`: postgres service
   container + `apt-get install redis-server`).

## CONDITIONAL — database changes

7. **Migration sanity** ✅ RUN if `migrations/` was added/changed
   - Confirm the plugin schema name is `plugin_<pluginname>` everywhere
     (models' `__table_args__` and the first migration's
     `CreateSchema(...)`/last migration's `DropSchema(...)`).
   - Confirm `upgrade()`/`downgrade()` are both implemented and are
     genuine inverses.
   - New non-nullable columns must be added in two steps: add with a
     `server_default`, then a later migration drops the default — a
     single-step `nullable=False` migration against an existing table
     will fail on real data.
   - If working inside a full Indico dev install, run
     `indico db --all-plugins upgrade` then `downgrade` once to confirm
     both directions execute without error.

## CONDITIONAL — frontend changes

8. **JS/TS lint** ⚠️ RUN if `client/` or `static/js` changed and
   `node_modules` is installed
   ```bash
   npx eslint .
   npx stylelint '**/*.scss'
   ```
   Skip with a note if `npm ci` hasn't been run.

9. **Webpack build** ⚠️ RUN if assets changed and a build config exists
   ```bash
   npx webpack --config ../indico/plugin.webpack.config.mjs
   ```
   Confirms `webpack-bundles.json` entries resolve and
   `static/dist/manifest.json` is produced for `inject_bundle()` to read.

## Task completion checklist

### MANDATORY (must all pass):
- [ ] `ruff check .` — clean
- [ ] `isort --check-only .` — clean
- [ ] `unbehead --check` — clean (or explicitly noted as unavailable)
- [ ] Plugin imports without error (if `indico` is importable)

### RECOMMENDED (run when the environment supports it):
- [ ] `pytest` — passing (or explicitly noted as skipped + why)
- [ ] Migration upgrade/downgrade both run cleanly (if `migrations/` touched)
- [ ] ESLint/stylelint clean (if frontend assets touched)
- [ ] Manually exercise the feature against a running Indico dev instance

### When tools aren't available

If `ruff`/`isort`/`unbehead` aren't installed, say so and recommend:
```bash
pip install -e ".[dev]"   # from inside the plugin dir, or
pip install ruff isort unbehead
```
If no Postgres/redis is reachable for `pytest`, say so and describe what a
passing run would have checked, rather than silently skipping without
comment.

## Additional resources

- `../indico/DEVELOPMENT.md` — local dev environment, migrations workflow,
  dependency management (`uv`).
- `../indico-plugins/.github/workflows/ci.yml` — the authoritative CI
  recipe this checklist is derived from.
- `.prompts/core/local-dev-environment.md` + `dev-env/` — one-command
  Postgres/redis via podman, and the full workflow for running a real
  Indico instance with the plugin installed for manual testing.
