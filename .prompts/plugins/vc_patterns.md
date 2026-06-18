# Video-Conference Plugin Patterns and Antipatterns

## ✅ Proven Patterns

### 1. Naming decided up front
Pick the `vc_<name>` package/repo name before writing any code — avoids a
late rename once `VCPluginMixin`'s assertion is hit.

### 2. Lazy provider client creation
```python
# ✅ Build the API client per-request/per-call, not at import time
def _get_client(self):
    return ProviderSDK(api_key=self.settings.get('api_key'))
```
Avoids import-time failures when credentials aren't configured yet (e.g.
during `pip install -e .` in CI before settings exist).

### 3. Graceful degradation when the room can't be created
```python
# ✅
try:
    room = self._create_remote_room(event)
except ProviderAPIError as exc:
    raise UserValueError(_('Could not create the meeting: {}').format(exc))
```
Surface a user-facing `UserValueError` rather than a raw 500.

## ❌ Common Antipatterns

### 1. Forgetting the `vc_` prefix, then working around it
Don't try to satisfy `VCPluginMixin`'s assertion by monkeypatching or
subclassing around it — rename the package. The check exists because
several core UI pieces also key off the `vc_` prefix.

### 2. Storing the provider's access token in event settings unencrypted
where a refresh-token flow is available — prefer storing a refresh token
and minting short-lived access tokens per call over storing a long-lived
secret directly in `event_settings`.

### 3. Blocking the request thread on provider API latency
```python
# ❌ Long synchronous call inside the request/response cycle
room = requests.post(provider_url, json=payload).json()

# ✅ Add a timeout, and consider whether room creation belongs in a
# background task if the provider API is slow
room = requests.post(provider_url, json=payload, timeout=10).json()
```
