# Security

- Check permissions before any action that reads/writes event, category,
  contribution, or registration data — use the existing ACL helpers
  (`event.can_manage(session.user)`, `category.can_manage(...)`,
  `can_access(...)`) rather than re-implementing permission logic.
- Never trust request data without going through `IndicoForm`/WTForms
  validation or explicit type coercion — don't hand-parse
  `request.args`/`request.form`/`request.json` for anything that affects
  state.
- `IndicoForm` already provides CSRF protection; don't bypass it by
  building raw HTML forms for state-changing actions.
- Render all user-supplied content through Jinja2's default autoescaping;
  never use `|safe`/`Markup()` on data that originated from a user unless
  it has been explicitly sanitized first.
- Store secrets (API keys, OAuth tokens) only via `settings_form` fields
  backed by `SettingsProxy` — never hardcode credentials or commit them in
  templates/static assets.
- File storage: go through the `Storage` abstraction
  (`indico.core.storage`) rather than raw filesystem/S3 calls, so access
  control and path handling stay consistent with core.
- When adding a new signal receiver, confirm it can't be triggered by an
  unauthenticated or unauthorized user to leak data (e.g. `template_hook`
  receivers run for every viewer of a page — check the viewer's
  permissions inside the receiver, don't assume the page itself gated it).
