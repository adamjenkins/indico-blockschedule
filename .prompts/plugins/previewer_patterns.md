# Previewer Plugin Patterns and Antipatterns

## ✅ Proven Patterns

### 1. Cheap type detection before expensive rendering
```python
# ✅ Check extension/MIME type first, bail out fast for non-matches
if not filename.endswith(('.ipynb',)):
    return None
```

### 2. Render to static markup, never execute untrusted content
```python
# ✅ Convert notebook JSON to HTML without executing cells
html = nbconvert.export(notebook_json, execute=False)
```

### 3. Cache rendered previews keyed by file revision
Avoids re-rendering an unchanged large notebook/file on every page view.

## ❌ Common Antipatterns

### 1. Executing untrusted file content to generate a preview
```python
# ❌ Wrong: never execute notebook cells, run uploaded scripts, etc. just
# to produce a preview
nbconvert.export(notebook_json, execute=True)
```

### 2. Unbounded rendering of arbitrarily large files
```python
# ❌
render_full_file(content)  # a 500MB log file will hang the request

# ✅
render_full_file(content[:MAX_PREVIEW_BYTES])
```

### 3. Trusting the file extension alone for type detection where content
sniffing is cheap and available — a `.ipynb`-named file that isn't valid
JSON should fail gracefully (no preview), not raise an unhandled
exception on the page.
