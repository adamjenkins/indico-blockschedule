# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

import pytest

from indico.core.db import db

from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.util import get_unscheduled_contributions, serialize_column, serialize_contribution


@pytest.mark.usefixtures('db')
def test_serialize_column_with_room(dummy_event, dummy_room):
    column = BlockScheduleColumn(event=dummy_event, room=dummy_room, position=1, label=dummy_room.full_name)
    db.session.add(column)
    db.session.flush()
    data = serialize_column(column)
    assert data['title'] == dummy_room.full_name
    assert data['room_id'] == dummy_room.id


@pytest.mark.usefixtures('db')
def test_serialize_column_without_room(dummy_event):
    column = BlockScheduleColumn(event=dummy_event, position=1, label='Main Hall')
    db.session.add(column)
    db.session.flush()
    data = serialize_column(column)
    assert data['title'] == 'Main Hall'
    assert data['room_id'] is None


@pytest.mark.usefixtures('db')
def test_unscheduled_contributions_excludes_scheduled(dummy_event, dummy_contribution):
    assert dummy_contribution in get_unscheduled_contributions(dummy_event)


@pytest.mark.usefixtures('db')
def test_serialize_contribution_not_starred_by_default(dummy_contribution, dummy_user):
    data = serialize_contribution(dummy_contribution, dummy_user)
    assert data['is_starred'] is False
    assert data['title'] == dummy_contribution.title


@pytest.mark.usefixtures('db')
def test_serialize_contribution_starred(dummy_contribution, dummy_user):
    dummy_user.favorite_contributions.add(dummy_contribution)
    db.session.flush()
    data = serialize_contribution(dummy_contribution, dummy_user)
    assert data['is_starred'] is True
