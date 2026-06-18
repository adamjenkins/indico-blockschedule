# Video-Conference Plugin Development Guide

Reference implementation: `../indico-plugins/vc_zoom/` — also the best
example of modern TSX frontend assets (see
`.prompts/patterns/assets-frontend.md`). `vc_dummy` is a minimal
reference with no real provider integration, useful for seeing the bare
minimum required shape.

## Hard constraint: naming

`VCPluginMixin.init()` asserts the plugin's short name starts with `vc_`.
Decide this is a VC plugin **before** naming the repository/package —
`indico_myconferencing` will raise at startup; `indico_vc_myconferencing`
will not.

## Base class

```python
from indico.modules.vc.plugins import VCPluginMixin
from indico.core.plugins import IndicoPlugin

class MyVCPlugin(VCPluginMixin, IndicoPlugin):
    configurable = True
    settings_form = SettingsForm
    vc_room_form = VCRoomForm                # creating/configuring a room
    vc_room_attach_form = VCRoomAttachForm    # attaching an existing room to an event

    @property
    def logo_url(self):
        return url_for_plugin('myconferencing.static', filename='images/logo.png')

    def create_form(self, event, existing_vc_room=None, **kwargs):
        ...

    def get_vc_room_form_defaults(self, event):
        ...
```

`category` is set to `PluginCategory.videoconference` automatically by
the mixin.

## What the mixin expects you to implement

- Room creation/management against the provider's API (create, update,
  delete a meeting/room).
- Attaching a room to an event/contribution so it shows up in the event's
  VC room list.
- `logo_url`/`icon_url` for how the provider shows up in the VC room type
  picker.
- A join flow — `vc_zoom`'s `client/JoinButton.tsx` is the reference for
  a client-rendered join button that calls back into a controller
  endpoint to mint a join URL/token.

## Frontend

VC plugins commonly need a richer client-side component (join button,
embedded widget) — see `.prompts/patterns/assets-frontend.md` and copy
`vc_zoom`'s `client/` layout (TSX + CSS modules) rather than starting
from plain JS if the UI is non-trivial.

## Testing

`vc_zoom` is in the CI test matrix — model `pytest.ini` and fixtures on
it. Mock the provider's API in tests; don't make real network calls to a
video-conferencing service from the test suite.
