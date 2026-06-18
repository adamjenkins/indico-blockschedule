# Generic Plugin Patterns and Antipatterns

## ✅ Proven Patterns

### 1. Signal-first integration

**Pattern**: Reach for a core signal before reaching for a database table
or a scheduled job.

```python
# ✅ React to the event already happening in core
self.connect(signals.event.registration_created, self._on_registration)
```

**Why this works**: stays in sync with core behavior automatically (no
polling, no missed updates if core changes how the event fires) and keeps
the plugin's footprint small.

### 2. Plugin-scoped settings instead of config files

```python
# ✅
api_key = MyPlugin.settings.get('api_key')

# ❌ Don't read a separate YAML/JSON config file the admin has to manage
# outside of Indico's own admin UI.
```

### 3. Template hooks for "add a widget", blueprints for "add a page"

Use `template_hook` when the goal is to augment an existing page; reserve
a full blueprint + RH for genuinely new pages/endpoints. Mixing the two
(building a whole new RH just to render a fragment that gets iframed into
an existing page) adds indirection for no benefit.

### 4. Defensive permission checks inside hook receivers

```python
def _inject_label(self, room, **kwargs):
    if not room.event.can_manage(session.user):
        return None
    return render_plugin_template('<pluginname>:_label.html', room=room)
```
A `template_hook` receiver runs for every viewer of the page it's
attached to — don't assume the page already gated access to what you're
about to render.

## ❌ Common Antipatterns

### 1. Reinventing core data access

```python
# ❌ Wrong: raw SQL or ad-hoc joins against core tables
result = db.session.execute('SELECT * FROM events.events WHERE ...')

# ✅ Use the model/query layer core already exposes
event = Event.get(event_id)
```

### 2. Settings without `default_settings`

```python
# ❌ Wrong: reading a setting that was never declared
MyPlugin.settings.get('undeclared_key')  # raises with strict_settings=True
```
Declare every key in `default_settings` up front, even if the default is
just `''` or `None`.

### 3. Skipping the `vc_`/mixin naming constraints

If a plugin is going to use `VCPluginMixin`, its plugin name **must**
start with `vc_` — Indico enforces this in `VCPluginMixin.init()` and
will raise otherwise. Decide the integration type before naming the
repository, not after.

### 4. Building a custom asset-injection mechanism

```python
# ❌ Wrong: copying the obsolete register_js_bundle/inject_css API from
# indico-plugin-example
self.inject_css('global_css')

# ✅ Current API
self.inject_bundle('main.css', WPEventDisplay)
```

### 5. Silent failures in CLI/background commands

```python
# ❌ Wrong
try:
    sync_external_system()
except Exception:
    pass

# ✅ Surface what happened
try:
    sync_external_system()
except Exception as exc:
    click.secho(f'Sync failed: {exc}', fg='red')
    raise
```

## 📋 Manual Testing Checklist

```
✅ Plugin Installation
- [ ] `pip install -e .` succeeds
- [ ] Plugin appears in `indico setup list-plugins`
- [ ] Adding it to `PLUGINS` in indico.conf and restarting doesn't error

✅ Settings
- [ ] Settings page appears under admin "Plugins" (if configurable)
- [ ] Saved settings persist and are read back correctly

✅ Permissions
- [ ] Feature respects event/category ACLs, not just "logged in"
- [ ] Template-hook content is hidden from users without access

✅ Migrations (if any)
- [ ] `indico db upgrade` then `downgrade` both succeed
- [ ] Schema name is `plugin_<pluginname>` throughout
```
