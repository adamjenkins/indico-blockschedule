"""Add session_blocks table

Revision ID: 7c4e1f8a9b21
Revises: 30f052669a6a
Create Date: 2026-06-21 09:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY


# revision identifiers, used by Alembic.
revision = '7c4e1f8a9b21'
down_revision = '30f052669a6a'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'session_blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('start_dt', sa.DateTime(), nullable=False),
        sa.Column('duration', sa.Interval(), nullable=False),
        sa.Column('column_ids', ARRAY(sa.Integer()), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['events.events.id']),
        sa.ForeignKeyConstraint(['session_id'], ['events.sessions.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='plugin_blockschedule',
    )
    op.create_index('ix_session_blocks_event_id', 'session_blocks', ['event_id'], schema='plugin_blockschedule')
    op.create_index('ix_session_blocks_session_id', 'session_blocks', ['session_id'], schema='plugin_blockschedule')


def downgrade():
    op.drop_index('ix_session_blocks_session_id', 'session_blocks', schema='plugin_blockschedule')
    op.drop_index('ix_session_blocks_event_id', 'session_blocks', schema='plugin_blockschedule')
    op.drop_table('session_blocks', schema='plugin_blockschedule')
