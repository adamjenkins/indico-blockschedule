# Feature Enhancement Workflow

1. **Read the existing plugin fully** before adding to it — identify
   which `.prompts/plugins/<type>.md` guide applies to what's already
   there (don't assume; check which mixin/base class is actually in use).
2. **Match existing conventions** in the plugin (settings key naming,
   form structure, template organization) over introducing a new style,
   unless the existing convention is itself the thing being fixed.
3. **Check for migration impact.** A new feature that adds a field to an
   existing model needs a new migration, not a change to an old one —
   never edit a migration that's already been applied/released (see
   `.prompts/patterns/models-migrations.md`'s two-step non-nullable
   column pattern if the new field is required).
4. **Settings**: extending `default_settings`/`default_event_settings` is
   backward compatible (existing installs just get the new default);
   renaming or removing a settings key is not — treat it as a breaking
   change requiring a migration path (read old key, write new key, in a
   one-time upgrade step) or a version bump communicated in the README.
5. **Re-run the full CI checklist**, including the parts specific to
   whatever the enhancement touched (frontend lint if assets changed,
   migration upgrade/downgrade if models changed).
6. **Update the plugin's own README/translations** if user-facing
   behavior or strings changed.
