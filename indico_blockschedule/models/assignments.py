# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico.core.db import db
from indico.util.string import format_repr


class BlockScheduleAssignment(db.Model):
    """Which column a scheduled contribution sits in.

    The actual time comes from the contribution's core `TimetableEntry`;
    this table only records the column (and thus the displayed room
    label), since that's no longer derivable from the contribution's own
    location fields (see `columns.py`).
    """

    __tablename__ = 'assignments'
    __table_args__ = (db.UniqueConstraint('contribution_id'),
                      {'schema': 'plugin_blockschedule'})

    id = db.Column(
        db.Integer,
        primary_key=True
    )
    contribution_id = db.Column(
        db.Integer,
        db.ForeignKey('events.contributions.id'),
        index=True,
        nullable=False
    )
    column_id = db.Column(
        db.Integer,
        db.ForeignKey('plugin_blockschedule.columns.id'),
        index=True,
        nullable=False
    )

    contribution = db.relationship(
        'Contribution',
        lazy=True,
        backref=db.backref(
            'blockschedule_assignment',
            lazy=True,
            uselist=False,
            cascade='all, delete-orphan'
        )
    )
    column = db.relationship(
        'BlockScheduleColumn',
        lazy=True,
        backref=db.backref(
            'assignments',
            lazy=True,
            cascade='all, delete-orphan'
        )
    )

    def __repr__(self):
        return format_repr(self, 'id', 'contribution_id', 'column_id')
