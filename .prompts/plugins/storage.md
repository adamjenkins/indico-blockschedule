# Storage Backend Plugin Development Guide

Reference implementation: `../indico-plugins/storage_s3/`
(`indico_storage_s3/storage.py`, `plugin.py`).

## When to use this guide

The plugin adds a new place Indico can store files (an alternative to the
built-in local-filesystem storage backend) — not a plugin that merely
*uses* file storage internally (that's a generic plugin using the
existing `Storage` API, see `.prompts/plugins/generic.md`).

## Base class

No special `IndicoPlugin` mixin is required — the plugin is a plain
`IndicoPlugin` that registers a storage backend class:

```python
from indico.core.storage import Storage  # or ReadOnlyStorageMixin for read-only backends

class S3Storage(Storage):
    name = 's3'

    def __init__(self, data):
        super().__init__(data)
        # parse the storage URI's backend-specific config here

    def open(self, file_id):
        ...

    def save(self, name, content_type, filename, fileobj):
        ...

    def delete(self, file_id):
        ...

    def getsize(self, file_id):
        ...
```

The plugin's `plugin.py` typically just needs to exist (no special init
beyond defaults) — the storage backend is selected via Indico's
`STORAGE_BACKENDS` config entry referencing the backend's `name`, not via
plugin-specific settings:
```python
# indico.conf
STORAGE_BACKENDS = {'s3': 's3:bucket=my-bucket,...'}
```
Check `storage_s3/indico_storage_s3/storage.py` for exactly how the URI
string after `name:` is parsed into backend options — there's a
convention (`key=value,key=value`) to follow rather than inventing a new
config format.

## Read-only backends

If the backend can't support writes (e.g. a frozen archive), subclass
`ReadOnlyStorageMixin` instead of implementing `save`/`delete` that raise.

## Security specifics

- Validate any path/key derived from user input before constructing
  remote object keys — don't let `../`-style traversal or arbitrary
  prefixes reach the backend's API calls.
- Use the cloud provider's IAM/least-privilege credentials scoped to only
  the bucket/prefix the plugin needs, documented in the plugin's README
  for the operator setting it up.

## Testing

`storage_s3` is in the CI test matrix. Tests typically run against a
mocked S3 (e.g. `moto`) rather than a real bucket — follow that pattern
rather than requiring real cloud credentials for the test suite to pass.
