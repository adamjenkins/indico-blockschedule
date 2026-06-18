# Search / Synchronization Plugin Development Guide

Reference implementations: `../indico-plugins/citadel/` (search indexing,
has models + migrations) and `../indico-plugins/livesync/` (the
`LiveSyncPluginBase` framework itself, plus `livesync_debug` as a minimal
example backend).

## When to use this guide

The plugin keeps an external system (search index, mirror, downstream
database) synchronized with Indico's data — typically by listening to
content-change signals and pushing updates, or by exposing a livesync
"agent" backend.

## Base class

```python
from indico_livesync import LiveSyncPluginBase
from indico.core.plugins import IndicoPlugin

class MySyncPlugin(LiveSyncPluginBase, IndicoPlugin):
    category = PluginCategory.search
    backend_class = MyBackend   # implemented in backend.py
```

`indico_livesync` is itself a separate plugin package providing the
livesync agent framework — a sync plugin depends on it
(`dependencies = ['indico-plugin-livesync']` alongside `indico>=...` in
`pyproject.toml`) rather than reimplementing the agent queue/backend
machinery from scratch. Check `citadel/pyproject.toml` for the exact
dependency declaration.

## Backend shape

`backend.py` implements the actual push/index logic — study
`citadel/indico_citadel/plugin.py` and its `backend.py` for the concrete
method set (initial full sync, incremental record updates, deletions).

## Models & migrations

`citadel` stores a mapping table (Indico object → external system ID) in
its own `plugin_citadel` schema — this is the canonical example for
`.prompts/patterns/models-migrations.md`'s schema-naming rule combined
with a real sync use case. Use it as the template for any sync plugin
that needs to track external IDs.

## Testing

`citadel` and `livesync` are both in the CI test matrix. Tests typically
mock the external system entirely (no real Elasticsearch/search backend
required) — assert on the calls the plugin *would* make, not on a live
external service's response.
