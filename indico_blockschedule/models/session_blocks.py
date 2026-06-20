# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from sqlalchemy.dialects.postgresql import ARRAY

from indico.core.db import db
from indico.core.db.sqlalchemy import UTCDateTime
from indico.util.string import format_repr


class BlockScheduleSessionBlock(db.Model):
    """A manually-placed "session block" banner spanning some/all columns.

    Deliberately *not* a core `SESSION_BLOCK` timetable entry: Block
    Schedule never creates those (see `assignments.py`). This is a purely
    presentational grouping banner, optionally tied to a real `Session`
    for its title/colour, rendered inside every column listed in
    `column_ids` (or every column, if `column_ids` is `NULL`).
    """

    __tablename__ = 'session_blocks'
    __table_args__ = {'schema': 'plugin_blockschedule'}

    id = db.Column(
        db.Integer,
        primary_key=True
    )
    event_id = db.Column(
        db.Integer,
        db.ForeignKey('events.events.id'),
        index=True,
        nullable=False
    )
    session_id = db.Column(
        db.Integer,
        db.ForeignKey('events.sessions.id'),
        index=True,
        nullable=True
    )
    title = db.Column(
        db.String,
        nullable=True
    )
    color = db.Column(
        db.String,
        nullable=True
    )
    start_dt = db.Column(
        UTCDateTime,
        nullable=False
    )
    duration = db.Column(
        db.Interval,
        nullable=False
    )
    column_ids = db.Column(
        ARRAY(db.Integer),
        nullable=True
    )

    event = db.relationship(
        'Event',
        lazy=True,
        backref=db.backref(
            'blockschedule_session_blocks',
            lazy=True,
            cascade='all, delete-orphan'
        )
    )
    session = db.relationship(
        'Session',
        lazy=True,
        backref=db.backref(
            'blockschedule_session_blocks',
            lazy=True
        )
    )

    def __repr__(self):
        return format_repr(self, 'id', 'event_id', 'session_id', _repr=self.title)
