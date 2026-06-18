# Refactoring Workflow

1. **No behavior change.** A refactor task should produce identical
   externally-observable behavior; if you find yourself also wanting to
   fix a bug or add a feature mid-refactor, do it as a separate follow-up
   change instead of bundling it in.
2. **Tests first.** If the code being refactored has no test coverage,
   add characterization tests for current behavior before changing
   structure — otherwise there's no way to confirm the refactor was
   behavior-preserving (see `.prompts/tasks/test.md`).
3. **Watch for these Indico-specific traps during a refactor:**
   - Moving a model to a different module is fine; changing its
     `__tablename__` or schema is not (it would require a migration, not
     just a refactor) — see `.prompts/patterns/models-migrations.md`.
   - Renaming a settings key changes stored data semantics, not just
     code — treat as out of scope for a pure refactor.
   - Renaming the plugin's entry-point short name or package name breaks
     existing installs' `PLUGINS` config — avoid unless explicitly asked.
4. **Re-run the full CI checklist** in `.prompts/core/ci-validation.md`
   after the refactor, same as any other change.
5. Prefer small, reviewable refactor commits over one large rewrite,
   especially when migrations or signal wiring are involved — easier to
   bisect if something breaks.
