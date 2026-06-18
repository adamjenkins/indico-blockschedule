# Bug Fix Workflow

1. **Reproduce first.** Write a failing `pytest` case (`*_test.py`) that
   demonstrates the bug before changing implementation code, if a test
   environment (Postgres + redis, see `.prompts/core/ci-validation.md`)
   is available. If not, reproduce manually against a running Indico dev
   instance and describe the exact repro steps in the eventual commit
   message.
2. **Find the root cause**, not just the symptom — check whether the bug
   is in the plugin's own code or in an assumption about a core API/signal
   that has since changed (compare against the version pinned in
   `dependencies = ['indico>=...']`).
3. **Fix at the right layer.** A bug surfacing in a template hook may
   actually be a missing permission check (see
   `.prompts/core/security-checklist.md`) or a stale settings value
   (`.prompts/patterns/forms-settings.md|) — don't patch around it in the
   template.
4. **Check for the same bug elsewhere** in the plugin — a missing
   permission check or an off-by-one in amount handling (payment plugins
   especially) is rarely isolated to one code path.
5. **Add/extend the regression test**, then run the full check list in
   `.prompts/core/ci-validation.md`.
6. If the bug involved a migration or model, confirm `upgrade`/`downgrade`
   still both work after the fix.
