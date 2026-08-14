# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

import pytest
from sqlalchemy.exc import IntegrityError

from indico.core.db import db

from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.models.groups import BlockScheduleGroup
from indico_blockschedule.util import serialize_group


def _column(event, label, position):
    column = BlockScheduleColumn(event=event, position=position, label=label)
    db.session.add(column)
    db.session.flush()
    return column


@pytest.mark.usefixtures('db')
def test_serialize_group_lists_its_columns(dummy_event):
    a = _column(dummy_event, '9F-01', 1)
    b = _column(dummy_event, '9F-02', 2)
    group = BlockScheduleGroup(event=dummy_event, title='9th Floor', position=1)
    group.columns = {a, b}
    db.session.add(group)
    db.session.flush()
    data = serialize_group(group)
    assert data['title'] == '9th Floor'
    assert data['column_ids'] == sorted([a.id, b.id])


@pytest.mark.usefixtures('db')
def test_column_can_belong_to_several_groups(dummy_event):
    hall = _column(dummy_event, '9F-01', 1)
    other = _column(dummy_event, '9F-02', 2)
    floor = BlockScheduleGroup(event=dummy_event, title='9th Floor', position=1)
    floor.columns = {hall, other}
    plenary = BlockScheduleGroup(event=dummy_event, title='Plenary Halls', position=2)
    plenary.columns = {hall}
    db.session.add_all([floor, plenary])
    db.session.flush()
    # Groups are a view concern, not a partition: overlapping membership is the
    # point (a room is both "on the 9th floor" and "a plenary hall").
    assert {g.title for g in hall.groups} == {'9th Floor', 'Plenary Halls'}
    assert {g.title for g in other.groups} == {'9th Floor'}


@pytest.mark.usefixtures('db')
def test_group_titles_are_unique_per_event(dummy_event):
    db.session.add(BlockScheduleGroup(event=dummy_event, title='9th Floor', position=1))
    db.session.flush()
    db.session.add(BlockScheduleGroup(event=dummy_event, title='9th Floor', position=2))
    with pytest.raises(IntegrityError):
        db.session.flush()
    db.session.rollback()


@pytest.mark.usefixtures('db')
def test_deleting_a_group_leaves_its_columns_alone(dummy_event):
    column = _column(dummy_event, '9F-01', 1)
    group = BlockScheduleGroup(event=dummy_event, title='9th Floor', position=1)
    group.columns = {column}
    db.session.add(group)
    db.session.flush()
    db.session.delete(group)
    db.session.flush()
    assert BlockScheduleColumn.query.filter_by(id=column.id).has_rows()
