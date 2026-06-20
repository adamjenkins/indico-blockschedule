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

    `session_id` is a snapshot of the contribution's `Session`, taken at
    scheduling time: core Indico only allows a session's contributions to
    be scheduled as children of a session-block timetable entry, but
    Block Schedule deliberately never creates those — so the contribution
    is detached from its session (`Contribution.session = None`) right
    before scheduling, and the original session is kept here purely for
    display/grouping. Track doesn't need this: `Contribution.track_id`
    has no such scheduling-time constraint, so it's read live instead.
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
    session_id = db.Column(
        db.Integer,
        db.ForeignKey('events.sessions.id'),
        index=True,
        nullable=True
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
    session = db.relationship(
        'Session',
        lazy=True,
        backref=db.backref(
            'blockschedule_assignments',
            lazy=True
        )
    )

    def __repr__(self):
        return format_repr(self, 'id', 'contribution_id', 'column_id')
