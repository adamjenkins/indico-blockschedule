# New Plugin Creation Workflow

## 1. Determine the plugin type

Read the user's description and match it against the categories in
`.prompts/plugins/`: payment, vc (video-conference), storage, search
(sync/indexing), previewer, theme, or generic (default). If the
description is ambiguous between generic and a specialized type, ask —
specialized types carry hard constraints (e.g. `vc_` naming) that are
costly to retrofit.

## 2. Pick the name now, not later

- Distribution name: `indico-plugin-<name>` (hyphens).
- Importable package: `indico_<name>` (underscores).
- If it's a VC plugin, `<name>` must start with `vc_`.
- Entry-point short name (the key under `[project.entry-points.'indico.plugins']`)
  is usually `<name>` without the `indico_` prefix.

## 3. Scaffold from a real reference plugin, not from scratch

Find the closest real example under `../indico-plugins/` (or
`../../indico-plugins/`) matching the detected type, and copy its
`pyproject.toml` shape, directory layout, and `plugin.py` structure as
the starting point. Never copy code from `../indico-plugin-example` — it
predates Python 3 and the current packaging/asset pipeline (see
`.prompts/core/base-instructions.md`).

## 4. Build incrementally

1. Minimal `IndicoPlugin` subclass that imports and loads (no blueprint,
   no models yet) — confirm `pip install -e .` + `indico setup
   list-plugins` shows it.
2. Add the blueprint/RH/forms for the core user-facing behavior.
3. Add settings (`configurable`, `settings_form`) if the plugin needs
   admin configuration.
4. Add models + migrations only if the plugin genuinely needs its own
   persisted data (`.prompts/patterns/models-migrations.md`).
5. Add frontend assets only if server-rendered templates aren't enough
   (`.prompts/patterns/assets-frontend.md`).
6. Add i18n scaffolding once the string set has stabilized somewhat —
   don't extract translations after every single string change.

## 5. Validate

Run everything in `.prompts/core/ci-validation.md` that the environment
supports. Don't declare the plugin "done" on the strength of lint/tests
alone if it has a UI — load it against a real Indico dev instance and
exercise the golden path manually.

## 6. Write the plugin's own README

Cover: what it does, required `indico.conf` settings (`PLUGINS`, any
`STORAGE_BACKENDS` entry, env vars/API keys it needs), and how to install
it for development (`pip install -e .`).
