"""Add room groups

Revision ID: a1c9f3e77b42
Revises: 7c4e1f8a9b21
Create Date: 2026-08-14 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a1c9f3e77b42'
down_revision = '7c4e1f8a9b21'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.events.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'title'),
        schema='plugin_blockschedule'
    )
    op.create_index(None, 'groups', ['event_id'], schema='plugin_blockschedule')
    # A column may be in any number of groups, and groups may overlap.
    op.create_table(
        'group_columns',
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('column_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['group_id'], ['plugin_blockschedule.groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['column_id'], ['plugin_blockschedule.columns.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('group_id', 'column_id'),
        schema='plugin_blockschedule'
    )


def downgrade():
    op.drop_table('group_columns', schema='plugin_blockschedule')
    op.drop_table('groups', schema='plugin_blockschedule')
