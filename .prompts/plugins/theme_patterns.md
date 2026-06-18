# Theme Plugin Patterns and Antipatterns

## ✅ Proven Patterns

### 1. Validate the theme descriptor at load time, not at render time
```python
# ✅ Fail fast with a clear error if the theme YAML is missing required keys
required = {'name', 'css', 'template'}
missing = required - theme_definition.keys()
if missing:
    raise RuntimeError(f'Theme definition missing keys: {missing}')
```

### 2. Scope theme CSS narrowly
```scss
/* ✅ Scoped to the themed event page container */
.theme-myevent .timetable { ... }

/* ❌ Unscoped, leaks into admin/non-themed pages */
.timetable { ... }
```

## ❌ Common Antipatterns

### 1. Hardcoding event-specific values into the theme
```python
# ❌ Wrong: a theme should be reusable across any event that selects it
title = 'My Specific Conference 2026'

# ✅ Pull from the event object passed into the template context
title = event.title
```

### 2. Skipping manual visual verification because automated tests pass
Theme YAML/structure tests passing doesn't mean the theme renders
correctly — always check a real event with the theme applied before
calling the work done.
