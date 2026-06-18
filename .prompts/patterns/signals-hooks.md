# Signals & Template Hooks

Most plugin integration happens by connecting to a core signal, not by
subclassing. Signals are defined throughout `indico/indico/core/signals/`;
the plugin-relevant ones live in `indico/core/signals/plugin.py`.

## Connecting to a signal

Always use `self.connect()` inside `init()`, never `signal.connect()`
directly — `IndicoPlugin.connect()` wraps the receiver so it executes
inside the plugin's app context (settings, gettext domain, etc. resolve
correctly).

```python
from indico.core import signals

class MyPlugin(IndicoPlugin):
    def init(self):
        super().init()
        self.connect(signals.plugin.cli, self._add_cli)
        self.connect(signals.plugin.shell_context, self._extend_shell_context)

    def _add_cli(self, sender, **kwargs):
        @cli_command()
        def mycommand():
            """A CLI command contributed by this plugin."""
            print('hello from mycommand')
        yield mycommand

    def _extend_shell_context(self, sender, add_to_context, **kwargs):
        add_to_context('my_helper', my_helper_function)
```

## Useful signals from `signals.plugin`

| Signal | Purpose |
|---|---|
| `get_blueprints` | Usually unnecessary to connect manually — return from `get_blueprints()` instead. |
| `cli` | Yield `click` commands to add to `indico` CLI, run inside plugin context. |
| `shell_context` | Add names/helpers to `indico shell`. |
| `template_hook` | Inject markup at a named extension point in a core template. |
| `inject_bundle` | Inject a built JS/CSS bundle into matching `WP` view classes. |
| `get_event_request_definitions` | Contribute an event "request" type (e.g. for VC, services). |
| `get_event_themes_files` / `get_conference_themes` | Contribute event/conference display themes. |
| `schema_pre_load` / `schema_post_load` / `schema_post_dump` | Hook into marshmallow (de)serialization. |
| `interceptable_function` | Override/wrap specific core function calls. |

Grep `indico/indico/core/signals/` for the full list relevant to the
feature you're building — the table above is not exhaustive.

## Template hooks (the most common "add a widget to an existing page" tool)

```python
def init(self):
    super().init()
    self.template_hook('event-vc-room-list-item-labels', self._inject_label)

def _inject_label(self, room, **kwargs):
    return render_plugin_template('myplugin:_label.html', room=room)
```

`template_hook(name, receiver, priority=50, markup=True)` registers a
receiver against `signals.plugin.template_hook`. Multiple plugins/receivers
can hook the same name; `priority` controls ordering. Find available hook
names by grepping core templates for `{{ template_hook('...') }}` /
`call_template_hook(...)`.

**Security note**: a template-hook receiver fires for every viewer of that
page — if your contributed markup is privileged, check permissions inside
the receiver itself (see `.prompts/core/security-checklist.md`).

## Asset injection

```python
def init(self):
    super().init()
    self.inject_bundle('main.js', WPEventDisplay)
    self.inject_bundle('main.css', WPEventDisplay)
```

This connects to `signals.plugin.inject_bundle` under the hood and reads
the bundle's built output via `self.manifest`
(`static/dist/manifest.json`, produced by webpack — see
`.prompts/patterns/assets-frontend.md`). `view_class` accepts a single WP
class or, if omitted along with `subclasses=True`, applies broadly —
prefer being specific about which views need the asset.
