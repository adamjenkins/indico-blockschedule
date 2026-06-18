# Theme Plugin Development Guide

Reference implementation: `../indico-plugins/themes_legacy/`.

## When to use this guide

The plugin contributes a display theme for event pages or conference
timetables (a CSS/template skin selectable from event display settings),
not a general UI tweak (use `template_hook` for that — see
`.prompts/plugins/generic.md`).

## Base class

Plain `IndicoPlugin`. Themes are registered by connecting to (or
implementing the method backing) the relevant signals:

```python
from indico.core import signals

class MyThemePlugin(IndicoPlugin):
    def init(self):
        super().init()
        self.connect(signals.plugin.get_event_themes_files, self._get_event_themes_files)
        self.connect(signals.plugin.get_conference_themes, self._get_conference_themes)

    def _get_event_themes_files(self, sender, **kwargs):
        ...  # return paths to theme YAML + CSS for single-event display

    def _get_conference_themes(self, sender, **kwargs):
        ...  # return conference-style (multi-page) theme definitions
```

Read `themes_legacy/indico_themes_legacy/plugin.py` for the exact return
shape expected by each signal — it's more reliable to copy the working
structure than to guess the schema.

## Theme assets

A theme is typically a YAML descriptor plus a CSS/SCSS file and possibly
Jinja2 template overrides for the timetable/event page layout. Keep theme
CSS scoped (don't leak selectors that affect non-themed admin UI) and
build it through the same webpack/static pipeline as any other plugin
asset if it needs compilation (see `.prompts/patterns/assets-frontend.md`).

## Testing

Theme correctness is largely visual — supplement any automated test
(theme YAML loads, required keys present) with manual verification: apply
the theme to a real event and check rendering, since `themes_legacy` is
not in CI's automated `test-plugin` matrix.
