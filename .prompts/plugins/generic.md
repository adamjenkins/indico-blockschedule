# Generic Plugin Development Guide

Use this guide unless the plugin clearly implements one of the
specialized integration points (payment, video-conference, storage,
search/sync, previewer, theme — see the other files in this directory).
Most plugins are generic: a CLI tool, an admin dashboard, a notification
integration, a page-content addition via template hooks, a REST endpoint
for an external system, etc.

## Minimal skeleton

`indico_<pluginname>/__init__.py`:
```python
from indico.util.i18n import make_bound_gettext

gettext = _ = make_bound_gettext('<pluginname>')
```

`indico_<pluginname>/plugin.py`:
```python
from indico.core import signals
from indico.core.plugins import IndicoPlugin, IndicoPluginBlueprint
from indico_<pluginname> import _
from indico_<pluginname>.blueprint import blueprint


class MyPlugin(IndicoPlugin):
    """My Plugin

    One-line description of what this plugin does.
    """

    def init(self):
        super().init()
        self.connect(signals.plugin.cli, self._add_cli)

    def get_blueprints(self):
        return blueprint

    def _add_cli(self, sender, **kwargs):
        ...
```

`indico_<pluginname>/blueprint.py`:
```python
from indico.core.plugins import IndicoPluginBlueprint
from indico_<pluginname>.controllers import RHMyPage

blueprint = IndicoPluginBlueprint('<pluginname>', __name__)
blueprint.add_url_rule('/my-page', 'my_page', RHMyPage)
```

`indico_<pluginname>/controllers.py`:
```python
from indico.web.rh import RH
from indico_<pluginname>.util import render_plugin_template

class RHMyPage(RH):
    def _process(self):
        return render_plugin_template('<pluginname>:my_page.html')
```

## `pyproject.toml`

Copy the shape from `../indico-plugins/payment_paypal/pyproject.toml` or
any other plugin with no special dependencies, then strip the
payment-specific bits:
```toml
[project]
name = 'indico-plugin-<pluginname>'
version = '0.1.0'
requires-python = '>=3.12.2, <3.13'
dependencies = ['indico>=3.3']

[project.entry-points.'indico.plugins']
<pluginname> = 'indico_<pluginname>.plugin:MyPlugin'

[build-system]
requires = ['hatchling==1.28.0']
build-backend = 'hatchling.build'

[tool.hatch.build]
packages = ['indico_<pluginname>']
```
Only add the `hatch_build.py` translation-compile hook (see
`.prompts/patterns/i18n.md`) once the plugin actually has translatable
strings worth shipping compiled.

## What to reach for, and where it's documented

- Adding markup to an existing page → `.prompts/patterns/signals-hooks.md`
  (`template_hook`).
- A settings page / admin-configurable options →
  `.prompts/patterns/forms-settings.md`.
- The plugin needs its own DB tables →
  `.prompts/patterns/models-migrations.md`.
- JS/CSS for the page → `.prompts/patterns/assets-frontend.md`.
- User-facing strings → `.prompts/patterns/i18n.md`.

## Common generic-plugin shapes seen in the wild

- **CLI/automation tool**: connects to `signals.plugin.cli` only, no
  blueprint, no templates (e.g. parts of `prometheus`).
- **External API bridge**: blueprint + RH classes exposing endpoints for
  an external system to call, settings form for API credentials.
- **Page enhancement**: one or more `template_hook` receivers, no
  blueprint of its own.
- **Notification/integration**: connects to event lifecycle signals
  (registration created, event published, etc. — grep
  `indico/core/signals/event.py` and friends) and pushes to an external
  service.

If, partway through building, the plugin turns out to need a payment
flow, a video-conference room, a storage backend, or a search/sync
backend, switch to the matching specialized guide in this directory —
don't bolt a mixin on after the fact without reading its constraints
(e.g. `VCPluginMixin` enforces a `vc_` name prefix).
