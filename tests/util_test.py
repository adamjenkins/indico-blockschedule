# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from datetime import UTC, datetime, timedelta

import pytest

from indico.core.db import db
from indico.modules.events.sessions.models.sessions import Session
from indico.modules.events.tracks.models.tracks import Track

from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.util import (autoschedule, get_unscheduled_contributions, serialize_column,
                                       serialize_contribution)


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


@pytest.mark.usefixtures('db')
def test_serialize_column_color(dummy_event):
    column = BlockScheduleColumn(event=dummy_event, position=1, label='Main Hall', color='3b82f6')
    db.session.add(column)
    db.session.flush()
    assert serialize_column(column)['color'] == '3b82f6'


@pytest.mark.usefixtures('request_context')
def test_autoschedule_keeps_session_together_in_one_column(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    column_b = BlockScheduleColumn(event=dummy_event, position=2, label='Room B')
    db.session.add_all([column_a, column_b])
    session_ = Session(event=dummy_event, title='Session')
    db.session.add(session_)
    db.session.flush()

    c1 = create_contribution(dummy_event, 'Talk 1', duration=timedelta(minutes=30), session=session_)
    c2 = create_contribution(dummy_event, 'Talk 2', duration=timedelta(minutes=30), session=session_)
    db.session.flush()

    start_dt = datetime(2026, 6, 18, 9, 0, tzinfo=UTC)
    end_dt = datetime(2026, 6, 18, 18, 0, tzinfo=UTC)
    leftover = autoschedule(dummy_event, [column_a, column_b], start_dt, end_dt, gap_minutes=10)

    assert leftover == []
    assert c1.blockschedule_assignment.column_id == c2.blockschedule_assignment.column_id
    assert c1.timetable_entry.start_dt < c2.timetable_entry.start_dt
    gap = c2.timetable_entry.start_dt - c1.timetable_entry.start_dt - c1.duration
    assert gap == timedelta(minutes=10)


@pytest.mark.usefixtures('db')
def test_autoschedule_groups_track_when_no_session(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    track = Track(event=dummy_event, title='Track')
    db.session.add(track)
    db.session.flush()

    c1 = create_contribution(dummy_event, 'Talk 1', duration=timedelta(minutes=20), track=track)
    c2 = create_contribution(dummy_event, 'Talk 2', duration=timedelta(minutes=20), track=track)
    standalone = create_contribution(dummy_event, 'Standalone', duration=timedelta(minutes=20))
    db.session.flush()

    start_dt = datetime(2026, 6, 18, 9, 0, tzinfo=UTC)
    end_dt = datetime(2026, 6, 18, 10, 0, tzinfo=UTC)
    leftover = autoschedule(dummy_event, [column_a], start_dt, end_dt, gap_minutes=0)

    assert leftover == []
    assert c1.blockschedule_assignment.column_id == c2.blockschedule_assignment.column_id
    assert standalone.timetable_entry is not None


@pytest.mark.usefixtures('db')
def test_autoschedule_reports_leftover_when_timespan_too_short(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    db.session.flush()
    create_contribution(dummy_event, 'Talk', duration=timedelta(minutes=30))

    start_dt = datetime(2026, 6, 18, 9, 0, tzinfo=UTC)
    end_dt = datetime(2026, 6, 18, 9, 10, tzinfo=UTC)
    leftover = autoschedule(dummy_event, [column_a], start_dt, end_dt, gap_minutes=0)

    assert len(leftover) == 1
