# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico.core.db import db
from indico.util.string import format_repr


class BlockScheduleColumn(db.Model):
    """A column (room slot) in a block schedule grid.

    `room` is an optional, purely informational link to a room-booking
    Room (used only to prefill `label` when creating the column) — the
    column always carries its own free-text `label`, which is what gets
    shown as the column header and on scheduled contributions' pages, so
    the grid works the same whether or not the room-booking module is
    enabled.
    """

    __tablename__ = 'columns'
    __table_args__ = (db.UniqueConstraint('event_id', 'position'),
                      {'schema': 'plugin_blockschedule'})

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
    room_id = db.Column(
        db.Integer,
        db.ForeignKey('roombooking.rooms.id'),
        index=True,
        nullable=True
    )
    position = db.Column(
        db.Integer,
        nullable=False
    )
    label = db.Column(
        db.String,
        nullable=False
    )
    color = db.Column(
        db.String,
        nullable=True
    )
    min_width_px = db.Column(
        db.Integer,
        nullable=True
    )

    event = db.relationship(
        'Event',
        lazy=True,
        backref=db.backref(
            'blockschedule_columns',
            lazy=True,
            cascade='all, delete-orphan'
        )
    )
    room = db.relationship(
        'Room',
        lazy=True,
        backref=db.backref(
            'blockschedule_columns',
            lazy=True
        )
    )

    @property
    def title(self):
        return self.label

    def __repr__(self):
        return format_repr(self, 'id', 'event_id', 'room_id', 'position', _repr=self.label)
