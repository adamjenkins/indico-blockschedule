# Search / Synchronization Plugin Patterns and Antipatterns

## ✅ Proven Patterns

### 1. Track external IDs in a mapping table, don't infer them
```python
# ✅ Explicit mapping table (plugin_<name> schema)
class ExternalMapping(db.Model):
    __table_args__ = {'schema': 'plugin_<pluginname>'}
    indico_id = db.Column(db.Integer, nullable=False)
    external_id = db.Column(db.String, nullable=False)
```
Avoids re-deriving the external ID from a naming convention that can
drift.

### 2. Batch + backoff for bulk initial sync
```python
# ✅
for batch in chunked(records, 100):
    push_batch(batch)
    time.sleep(backoff_seconds)
```
Initial full syncs can be large — don't hammer the external API with one
record per request and no rate limiting.

### 3. Idempotent push operations
Pushing the same record twice (e.g. after a retry) should produce the
same end state in the external system, not duplicate entries — use
upsert-style external APIs where available.

## ❌ Common Antipatterns

### 1. Synchronous push inside the request that triggered the change
```python
# ❌ Wrong: user-facing request blocks on an external API call
def _on_event_updated(self, event, **kwargs):
    push_to_external_system(event)  # could be slow/flaky

# ✅ Queue it (livesync's own agent/queue mechanism exists for this —
# use it rather than building a new background-job system)
```

### 2. Reimplementing the livesync queue instead of using
`indico_livesync`'s existing agent framework — leads to duplicated retry/
backoff logic that the framework already handles.

### 3. Treating "external system unreachable" as "delete the record"
```python
# ❌
try:
    external_get(external_id)
except NotFoundError:
    delete_local_mapping(external_id)  # could also mean a transient outage

# ✅ Distinguish "confirmed deleted upstream" from "couldn't reach upstream"
```
