"""Create blockschedule schema

Revision ID: 1eee092345d8
Revises:
Create Date: 2026-06-18 14:47:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.sql.ddl import CreateSchema, DropSchema


# revision identifiers, used by Alembic.
revision = '1eee092345d8'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute(CreateSchema('plugin_blockschedule'))
    op.create_table(
        'columns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False, index=True),
        sa.Column('room_id', sa.Integer(), nullable=False, index=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['events.events.id']),
        sa.ForeignKeyConstraint(['room_id'], ['roombooking.rooms.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'position'),
        sa.UniqueConstraint('event_id', 'room_id'),
        schema='plugin_blockschedule'
    )


def downgrade():
    op.drop_table('columns', schema='plugin_blockschedule')
    op.execute(DropSchema('plugin_blockschedule'))
