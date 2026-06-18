# Models & Migrations

Only needed if the plugin stores its own data in the database (most
generic plugins don't — check `.prompts/plugins/generic.md` first; plugins
like `citadel` that synchronize/index data are the common case that does).

## The schema-naming rule

Every model contributed by a plugin must live in a Postgres schema named
`plugin_<pluginname>`:

```python
from indico.core.db import db

class MyMapping(db.Model):
    __tablename__ = 'mappings'
    __table_args__ = {'schema': 'plugin_<pluginname>'}

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.ForeignKey('events.events.id'), nullable=False)
```

`IndicoPlugin._import_models()` auto-imports everything under
`indico_<pluginname>/models/` at plugin init time and will raise if a
model's schema doesn't follow this convention. There's no way to opt out
of this — get the schema name right from the first migration.

## Migrations (Alembic)

Location: `indico_<pluginname>/migrations/` — `IndicoPlugin.init()` sets
`alembic_versions_path` to this directory automatically; you don't need to
configure anything else for Indico's `db` CLI to find it.

Filename convention (matches core Indico, not generic Alembic defaults):
```
YYYYMMDD_HHMM_<revision>_<slug>.py
```
e.g. `20210330_1742_0cf18be7ade1_add_mapping_table.py`.

First migration for a new plugin must create the schema; the last
migration (full uninstall path) must drop it:

```python
from alembic import op
from sqlalchemy.schema import CreateSchema, DropSchema

def upgrade():
    op.execute(CreateSchema('plugin_<pluginname>'))
    op.create_table('mappings', ..., schema='plugin_<pluginname>')

def downgrade():
    op.drop_table('mappings', schema='plugin_<pluginname>')
    op.execute(DropSchema('plugin_<pluginname>'))
```

A `.no-header` marker file can be placed in `migrations/` to suppress the
license-header lint check for that directory (Alembic revision files are
machine-generated boilerplate and conventionally exempt).

## Two-step non-nullable column additions

Adding a `nullable=False` column directly will fail against a table that
already has rows. Split it across two migrations:

1. Add the column with a `server_default` (nullable for now).
2. A later migration drops the server default and flips `nullable=False`
   once all rows have a real value.

## Verifying migrations match the models

If working inside a full Indico dev checkout (`../indico` or
`../../indico`), use its maintenance scripts after any model change:

```bash
python ../indico/bin/maintenance/update_backrefs.py
python ../indico/bin/utils/db_diff.py
```

`db_diff.py` diffs the live (migrated) schema against what the
SQLAlchemy models declare — a non-empty diff means a migration is missing
or wrong. Also manually run both directions before considering a migration
done:

```bash
indico db --all-plugins upgrade
indico db --all-plugins downgrade
```
