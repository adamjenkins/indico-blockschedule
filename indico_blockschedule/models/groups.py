# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico.core.db import db
from indico.util.string import format_repr


group_columns_table = db.Table(
    'group_columns',
    db.metadata,
    db.Column(
        'group_id',
        db.Integer,
        db.ForeignKey('plugin_blockschedule.groups.id', ondelete='CASCADE'),
        primary_key=True
    ),
    db.Column(
        'column_id',
        db.Integer,
        db.ForeignKey('plugin_blockschedule.columns.id', ondelete='CASCADE'),
        primary_key=True
    ),
    schema='plugin_blockschedule'
)


class BlockScheduleGroup(db.Model):
    """A named set of columns (rooms) within an event's block schedule.

    Groups exist to make a wide schedule printable and readable: "9th
    floor", "Main hall", "Workshops". A column may belong to any number of
    groups (a room can be both "9th floor" and "Plenary"), and groups may
    overlap freely — they are a view concern, not a partition, and nothing
    about scheduling consults them.

    Tracks are deliberately NOT stored here: they are offered as groups in
    the UI directly from the event's own tracks, so they cannot drift out of
    sync with them.
    """

    __tablename__ = 'groups'
    __table_args__ = (db.UniqueConstraint('event_id', 'title'),
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
    position = db.Column(
        db.Integer,
        nullable=False
    )
    title = db.Column(
        db.String,
        nullable=False
    )

    event = db.relationship(
        'Event',
        lazy=True,
        backref=db.backref(
            'blockschedule_groups',
            lazy='dynamic'
        )
    )
    columns = db.relationship(
        'BlockScheduleColumn',
        secondary=group_columns_table,
        lazy=True,
        collection_class=set,
        backref=db.backref(
            'groups',
            lazy=True,
            collection_class=set
        )
    )

    def __repr__(self):
        return format_repr(self, 'id', 'event_id', _text=self.title)
