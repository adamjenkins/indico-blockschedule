"""Decouple columns from room booking, add assignments table

Revision ID: 01d47f24ad61
Revises: 1eee092345d8
Create Date: 2026-06-18 16:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = '01d47f24ad61'
down_revision = '1eee092345d8'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('''
        UPDATE plugin_blockschedule.columns c
        SET label = COALESCE(r.verbose_name, 'Untitled')
        FROM roombooking.rooms r
        WHERE c.room_id = r.id AND c.label IS NULL
    ''')
    op.execute("UPDATE plugin_blockschedule.columns SET label = 'Untitled' WHERE label IS NULL")
    op.alter_column('columns', 'label', nullable=False, schema='plugin_blockschedule')
    op.alter_column('columns', 'room_id', nullable=True, schema='plugin_blockschedule')
    op.drop_constraint('uq_columns_event_id_room_id', 'columns', schema='plugin_blockschedule')
    op.create_table(
        'assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contribution_id', sa.Integer(), nullable=False, index=True),
        sa.Column('column_id', sa.Integer(), nullable=False, index=True),
        sa.ForeignKeyConstraint(['contribution_id'], ['events.contributions.id']),
        sa.ForeignKeyConstraint(['column_id'], ['plugin_blockschedule.columns.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contribution_id'),
        schema='plugin_blockschedule'
    )


def downgrade():
    op.drop_table('assignments', schema='plugin_blockschedule')
    op.create_unique_constraint('uq_columns_event_id_room_id', 'columns', ['event_id', 'room_id'],
                                schema='plugin_blockschedule')
    op.alter_column('columns', 'room_id', nullable=False, schema='plugin_blockschedule')
    op.alter_column('columns', 'label', nullable=True, schema='plugin_blockschedule')
