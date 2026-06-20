"""Add assignments.session_id snapshot and columns.min_width_px

Revision ID: 30f052669a6a
Revises: b319b5b17a51
Create Date: 2026-06-20 09:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = '30f052669a6a'
down_revision = 'b319b5b17a51'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('assignments', sa.Column('session_id', sa.Integer(), nullable=True),
                  schema='plugin_blockschedule')
    op.create_index('ix_assignments_session_id', 'assignments', ['session_id'], schema='plugin_blockschedule')
    op.create_foreign_key('fk_assignments_session_id_sessions', 'assignments', 'sessions', ['session_id'], ['id'],
                          source_schema='plugin_blockschedule', referent_schema='events')
    op.add_column('columns', sa.Column('min_width_px', sa.Integer(), nullable=True), schema='plugin_blockschedule')


def downgrade():
    op.drop_column('columns', 'min_width_px', schema='plugin_blockschedule')
    op.drop_constraint('fk_assignments_session_id_sessions', 'assignments', schema='plugin_blockschedule',
                      type_='foreignkey')
    op.drop_index('ix_assignments_session_id', 'assignments', schema='plugin_blockschedule')
    op.drop_column('assignments', 'session_id', schema='plugin_blockschedule')
