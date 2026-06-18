# Forms & Settings

## Plugin settings (admin-configurable)

```python
from wtforms.fields import StringField, BooleanField
from indico.web.forms.base import IndicoForm

class SettingsForm(IndicoForm):
    api_key = StringField('API key')
    enabled = BooleanField('Enabled')

class MyPlugin(IndicoPlugin):
    configurable = True
    settings_form = SettingsForm
    default_settings = {'api_key': '', 'enabled': False}
```

Setting `configurable = True` + `settings_form` is enough to get an entry
on Indico's admin "Plugins" page — don't build a custom settings page
unless the built-in one genuinely can't express what you need.

Read settings via the cached `SettingsProxy`:
```python
MyPlugin.settings.get('api_key')
MyPlugin.settings.set('api_key', new_value)
```

Per-event or per-user settings work the same way with
`default_event_settings` / `default_user_settings`, accessed via
`MyPlugin.event_settings` / `MyPlugin.user_settings` (scoped automatically
by event/user — no manual key-prefixing needed).

`strict_settings = True` is the default — settings must be declared in
`default_settings` ahead of time. Only set it `False` if the plugin
genuinely needs arbitrary/dynamic keys.

## User-facing forms

Subclass `IndicoForm` (not raw WTForms `Form`) for anything that handles a
real HTTP request — it wires up CSRF protection and Indico's field/widget
conventions automatically.

```python
from indico.web.forms.base import IndicoForm
from indico.web.forms.fields import IndicoPasswordField
from indico.web.forms.validators import HiddenUnless
from wtforms.fields import StringField, BooleanField
from wtforms.validators import DataRequired

class MyForm(IndicoForm):
    use_custom_token = BooleanField('Use custom token')
    token = IndicoPasswordField('Token', [HiddenUnless('use_custom_token'), DataRequired()])
```

Useful building blocks in `indico.web.forms.fields`/`.widgets`/`.validators`:
`IndicoPasswordField`, `TextListField`, `SwitchWidget`, `TinyMCEWidget`,
`HiddenUnless`, `UsedIf`. Prefer these over hand-rolled WTForms fields so
the rendered UI matches core Indico's look and validation behavior.

## Mixin-specific settings form bases

Some extension points require subclassing a more specific form base
instead of plain `IndicoForm`:

- Payment plugins: `PaymentPluginSettingsFormBase` (global) and
  `PaymentEventSettingsFormBase` (per-event) — see
  `.prompts/plugins/payment.md`.
- Video-conference plugins: forms referenced by `vc_room_form` /
  `vc_room_attach_form` class attributes — see `.prompts/plugins/vc.md`.

Check the relevant `.prompts/plugins/<type>.md` guide before assuming
plain `IndicoForm` is sufficient for a specialized plugin type.
