"""Add color to columns

Revision ID: b319b5b17a51
Revises: 01d47f24ad61
Create Date: 2026-06-19 10:30:00.000000
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = 'b319b5b17a51'
down_revision = '01d47f24ad61'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('columns', sa.Column('color', sa.String(), nullable=True), schema='plugin_blockschedule')


def downgrade():
    op.drop_column('columns', 'color', schema='plugin_blockschedule')
