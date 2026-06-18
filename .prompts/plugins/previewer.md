# Previewer Plugin Development Guide

Reference implementations: `../indico-plugins/previewer_code/` and
`../indico-plugins/previewer_jupyter/`.

## When to use this guide

The plugin renders an in-browser preview for a specific file type
attached to an event/contribution (source code syntax highlighting,
Jupyter notebook rendering, etc.) rather than forcing a download.

## Base class

Plain `IndicoPlugin` — there is no dedicated previewer mixin. Integration
happens by connecting to the file-preview signal(s)/extension points core
exposes for attachment rendering. Grep `indico/indico/modules/attachments/`
and `indico/indico/core/signals/` for the exact hook names
(`previewer_jupyter`/`previewer_code` are the authoritative examples —
read their `plugin.py` in full before writing a new one, since the exact
signal name is more reliably learned from a working example than
restated here and may shift between minor versions).

## Shape

1. Detect whether a given attachment/file is one this previewer handles
   (by extension/MIME type).
2. Render the preview — `previewer_code` does server-side syntax
   highlighting into a template fragment; `previewer_jupyter` converts
   notebook JSON into rendered HTML (likely via `nbconvert` or similar —
   check its `pyproject.toml` dependencies for the exact library used).
3. Return that fragment to be embedded where core shows attachment
   previews.

## Performance & safety

- Previewing is triggered by viewing a page that lists/shows the
  attachment — keep rendering fast or cache the rendered output, since it
  runs on a request path, not in the background.
- Treat the file content as untrusted: a malicious upload disguised as a
  supported type shouldn't be able to execute code or exfiltrate data
  during preview rendering (notably relevant for notebook previewers,
  which must render Jupyter JSON as static HTML, never execute its
  cells).

## Testing

Check whichever of `previewer_code`/`previewer_jupyter` is structurally
closer to the new file type for `pytest.ini`/test layout conventions.
