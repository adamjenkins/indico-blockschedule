# Storage Backend Plugin Patterns and Antipatterns

## ✅ Proven Patterns

### 1. Parse the backend URI once, fail fast on bad config
```python
# ✅
def __init__(self, data):
    super().__init__(data)
    try:
        self.bucket = self._parse_options(data)['bucket']
    except KeyError:
        raise RuntimeError("storage backend 's3' requires a 'bucket' option")
```

### 2. Stream large files rather than loading fully into memory
```python
# ✅
def save(self, name, content_type, filename, fileobj):
    self.client.upload_fileobj(fileobj, self.bucket, key)
```

## ❌ Common Antipatterns

### 1. Constructing remote keys from unsanitized user input
```python
# ❌ Wrong: filename could contain path traversal or backend-special chars
key = filename

# ✅ Use the file_id/UUID Indico already generates, not the user-supplied filename, as the key
key = file_id
```

### 2. Swallowing backend errors as "file not found"
```python
# ❌
def open(self, file_id):
    try:
        return self.client.get_object(...)
    except Exception:
        return None  # masks auth errors, network errors, etc. as missing files

# ✅ Only translate the backend's specific "not found" exception
except self.client.exceptions.NoSuchKey:
    raise FileNotFoundError(file_id)
```

### 3. Requiring real cloud credentials for the test suite
Use a mocking library (`moto` for S3-compatible backends) so `pytest`
runs offline and in CI without provisioning real cloud resources.
