# Core Indico Plugin Development Principles

## Indico coding style

* Source of truth: `../indico/ruff.toml` (or `ruff.toml` in this plugin once
  copied from a reference plugin) — target Python 3.12, line length 120.
* Run `ruff check .` and `isort --check-only .` before considering any
  Python change done. Also run `unbehead --check` (license header linter).
* Filenames and modules: lowercase with underscores, importable package is
  always `indico_<pluginname>` (underscores), the **distribution name** in
  `pyproject.toml` is `indico-plugin-<pluginname>` (hyphens).
* Entry point group is literally `indico.plugins`:
  ```toml
  [project.entry-points.'indico.plugins']
  <shortname> = 'indico_<pluginname>.plugin:YourPluginClass'
  ```
* Strings: use `gettext`/`_`/`ngettext` bound to the plugin via
  `make_bound_gettext('<pluginname>')`, defined once in the plugin
  package's `__init__.py` and imported everywhere else as
  `from indico_<pluginname> import _`. Never hardcode user-facing text.
* Terminate lines with LF. No trailing whitespace.

## Plugin architecture in one paragraph

A plugin is a Python package (`indico_<name>`) with one or more
`IndicoPlugin` subclasses (commonly just one, in `plugin.py`), registered
via the `indico.plugins` entry point. Most behavior is added by **either**
overriding methods Indico calls automatically (`get_blueprints`,
`register_assets`-style hooks) **or** connecting to core signals
(`self.connect(signals.x.y, handler)`), not by inheriting deep class
hierarchies. A handful of integration points (payment, video-conference,
storage) provide a dedicated mixin/base class — see
`.prompts/plugins/*.md` for which one applies. When in doubt, start from
the **generic** plugin guide; only reach for a specialized mixin if the
plugin genuinely implements that integration point.

## Required reading before writing code

1. `.prompts/plugins/<detected-type>.md` and its `_patterns.md` companion.
2. The closest matching real plugin under `../indico-plugins/` (or
   `../../indico-plugins/` if working from a subfolder one level deeper —
   check both). Copy its `pyproject.toml` shape, don't write one from
   scratch.
3. Never copy code from `../indico-plugin-example` verbatim — it predates
   Python 3, `pyproject.toml`/hatchling, and the current asset pipeline.
   It's only useful for confirming that an API (e.g. `signals.plugin.cli`,
   `IndicoPluginBlueprint`, `render_plugin_template`) still exists, not for
   syntax or packaging.

## Project layout

```
indico_<pluginname>/
├── pyproject.toml              # hatchling, entry-points.'indico.plugins'
├── pytest.ini                  # indico_plugins = <pluginname>; python_files = *_test.py
├── README.md
└── indico_<pluginname>/
    ├── __init__.py             # gettext = _ = make_bound_gettext('<pluginname>')
    ├── plugin.py                # the IndicoPlugin subclass
    ├── blueprint.py             # IndicoPluginBlueprint + add_url_rule(...)
    ├── controllers.py           # RH (request handler) classes
    ├── forms.py                 # IndicoForm subclasses (settings, user-facing)
    ├── util.py
    ├── models/                  # only if the plugin has its own DB tables
    ├── migrations/               # Alembic revisions for models/ above
    ├── static/                   # images, scss; or webpack-bundles.json + client/ for JS/TS
    ├── templates/                 # Jinja2 .html, rendered via render_plugin_template
    └── translations/              # babel .pot/.po (compiled to .mo at build time)
```

## Database schema rule (easy to miss, breaks at runtime if skipped)

Any SQLAlchemy model contributed by a plugin **must** live in a DB schema
named `plugin_<pluginname>` (e.g. `__table_args__ = {'schema':
'plugin_citadel'}`). `IndicoPlugin._import_models()` raises if this rule
is violated. The first Alembic migration for the plugin must create that
schema (`op.execute(CreateSchema('plugin_<pluginname>'))`) and the final
downgrade migration must drop it. See `.prompts/patterns/models-migrations.md`.

## Settings & configuration

Set `configurable = True` and `settings_form = YourSettingsForm` on the
plugin class to get an auto-generated entry on Indico's admin "Plugins"
page — don't hand-roll a settings page. Access stored settings via
`YourPlugin.settings.get('key')` (also `.event_settings`, `.user_settings`
if `default_event_settings`/`default_user_settings` are declared). See
`.prompts/patterns/forms-settings.md`.

## Versioning & compatibility

* Plugin version: plain semver string in `pyproject.toml` → `[project]
  version`.
* Compatibility range: `dependencies = ['indico>=3.3']` (tighten if the
  plugin relies on APIs from a specific minor version).
* Installed for development with `pip install -e .` from inside the
  plugin directory (requires an `indico[dev]` environment — see
  `../indico/DEVELOPMENT.md`). Enabled at runtime by adding the plugin's
  short name to `PLUGINS = {...}` in `indico.conf`.

## Locating the reference repos

These prompt files assume the following are available for reference
(read-only — never modify them):

* Indico core source: try `../indico`, then `../../indico`, then
  `$INDICO_DIR` if set.
* Official plugin collection (real-world examples): try `../indico-plugins`,
  then `../../indico-plugins`.

If neither resolves, ask the user where the Indico core checkout lives
before proceeding with anything that needs it (CI commands, signal
lookups, model inspection).
