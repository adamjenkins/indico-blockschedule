# Adding Tests

## Conventions

- Test files match `*_test.py`, **not** `test_*.py` — this is Indico's
  pytest plugin convention (`pytest.ini`: `python_files = *_test.py`).
- `pytest.ini` must declare `indico_plugins = <pluginname>` so Indico's
  pytest plugin loads it for the session.
- Place tests either in a top-level `tests/` directory or alongside the
  code as `<module>_test.py` (citadel does both — `util_test.py` next to
  `util.py` for unit tests, `tests/` for broader integration tests).
- A `conftest.py` with `pytest_plugins = ('indico', 'indico_<pluginname>.fixtures')`
  pulls in core's test fixtures plus any custom plugin fixtures module.

## Requirements

Tests that touch the database need a reachable Postgres
(`INDICO_TEST_DATABASE_URI` env var) and `redis-server` on `PATH`. If
these aren't available in the current environment, say so explicitly
rather than silently skipping — see `.prompts/core/ci-validation.md`.

## Common fixtures (from Indico core)

- `db` — database session.
- `request_context` — push a Flask request context.
- `dummy_event` — a pre-built `Event` for tests that need one without
  constructing it manually.

Grep `indico/indico/testing/` and the `conftest.py` of a reference plugin
for the full fixture set rather than assuming one exists.

## What to test

- Pure logic (amount calculations, mapping/serialization) — straightforward
  unit tests, no fixtures needed.
- RH/controller behavior — use `request_context` + a test client.
- Permission boundaries — assert that a user without the right capability
  gets denied, not just that an authorized user succeeds.
- Migrations — `upgrade()`/`downgrade()` both run without error (can be a
  manual check via `indico db upgrade`/`downgrade` if not automated).

## Mocking external systems

Payment/VC/storage/search plugins all talk to an external provider —
mock it (`moto` for S3-style backends, `responses`/`requests-mock` for
HTTP APIs, or the provider's own test/sandbox SDK mode) rather than
making real network calls or requiring real credentials in CI.
