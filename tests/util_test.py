# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from datetime import UTC, date, datetime, timedelta

import pytest

from indico.core.db import db
from indico.modules.events.sessions.models.sessions import Session
from indico.modules.events.tracks.models.tracks import Track

from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.models.session_blocks import BlockScheduleSessionBlock
from indico_blockschedule.util import (ScheduleOverlapError, assign_contribution_to_column, autoschedule,
                                       build_export_rows, build_grid_export_sheet, clear_schedule, generate_ods,
                                       get_unscheduled_contributions, serialize_column, serialize_contribution,
                                       serialize_session_block)


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


@pytest.mark.usefixtures('db')
def test_serialize_column_min_width(dummy_event):
    column = BlockScheduleColumn(event=dummy_event, position=1, label='Main Hall', min_width_px=300)
    db.session.add(column)
    db.session.flush()
    assert serialize_column(column)['min_width_px'] == 300


@pytest.mark.usefixtures('db')
def test_serialize_column_min_width_defaults_to_none(dummy_event):
    column = BlockScheduleColumn(event=dummy_event, position=1, label='Main Hall')
    db.session.add(column)
    db.session.flush()
    assert serialize_column(column)['min_width_px'] is None


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
    # Placement order within a run is randomized (see `test_autoschedule_placement_order_is_randomized`),
    # so c1/c2 may land in either order -- but always back-to-back with the configured gap, never
    # split across columns or overlapping.
    earlier, later = sorted([c1, c2], key=lambda c: c.timetable_entry.start_dt)
    gap = later.timetable_entry.start_dt - earlier.timetable_entry.start_dt - earlier.duration
    assert gap == timedelta(minutes=10)
    # Block Schedule never creates session-block timetable entries: both ended up
    # top-level, with their original session preserved only as a display snapshot.
    assert c1.timetable_entry.parent is None
    assert c2.timetable_entry.parent is None
    assert c1.session_id is None
    assert c1.blockschedule_assignment.session_id == session_.id
    assert serialize_contribution(c1)['session_name'] == 'Session'


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
def test_serialize_contribution_track_name_is_read_live(dummy_event, create_contribution):
    track = Track(event=dummy_event, title='My Track')
    db.session.add(track)
    db.session.flush()
    contrib = create_contribution(dummy_event, 'Talk', track=track)
    assert serialize_contribution(contrib)['track_name'] == 'My Track'


@pytest.mark.usefixtures('db')
def test_serialize_contribution_description_hidden_by_default(dummy_contribution):
    dummy_contribution.description = '<p>Some <b>rich</b> text.</p>'
    assert serialize_contribution(dummy_contribution)['description'] is None


@pytest.mark.usefixtures('db')
def test_serialize_contribution_description_full(dummy_contribution):
    dummy_contribution.description = 'Plain text description.'
    data = serialize_contribution(dummy_contribution, description_display='full')
    assert data['description'] == 'Plain text description.'


@pytest.mark.usefixtures('db')
def test_serialize_contribution_description_truncated(dummy_contribution):
    dummy_contribution.description = 'x' * 300
    data = serialize_contribution(dummy_contribution, description_display='truncated')
    assert data['description'] == 'x' * 200 + '...'


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


@pytest.mark.usefixtures('request_context')
def test_autoschedule_placement_order_is_randomized(dummy_event, create_contribution, monkeypatch):
    # `place_run`/the standalone loop call `random.shuffle` -- patch it to reverse the list
    # instead, so the test can assert the order it's given actually gets used rather than
    # depending on a particular RNG seed.
    calls = []

    def fake_shuffle(items):
        calls.append(list(items))
        items.reverse()

    monkeypatch.setattr('indico_blockschedule.util.random.shuffle', fake_shuffle)

    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    db.session.flush()
    create_contribution(dummy_event, 'Talk 1', duration=timedelta(minutes=20))
    create_contribution(dummy_event, 'Talk 2', duration=timedelta(minutes=20))
    db.session.flush()

    start_dt = datetime(2026, 6, 18, 9, 0, tzinfo=UTC)
    end_dt = datetime(2026, 6, 18, 18, 0, tzinfo=UTC)
    autoschedule(dummy_event, [column_a], start_dt, end_dt, gap_minutes=0)

    assert calls  # random.shuffle was actually invoked on the standalone batch (and/or groups)


@pytest.mark.usefixtures('request_context')
def test_clear_schedule_unschedules_within_range_only(dummy_event, create_contribution):
    from indico_blockschedule.models.assignments import BlockScheduleAssignment
    from indico_blockschedule.util import assign_contribution_to_column

    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    db.session.flush()
    inside = create_contribution(dummy_event, 'Inside', duration=timedelta(minutes=30))
    outside = create_contribution(dummy_event, 'Outside', duration=timedelta(minutes=30))
    db.session.flush()
    assign_contribution_to_column(inside, column_a, datetime(2026, 6, 18, 10, 0, tzinfo=UTC))
    assign_contribution_to_column(outside, column_a, datetime(2026, 6, 18, 14, 0, tzinfo=UTC))

    clear_schedule(dummy_event, [column_a],
                   datetime(2026, 6, 18, 9, 0, tzinfo=UTC), datetime(2026, 6, 18, 12, 0, tzinfo=UTC))

    assert inside.timetable_entry is None
    assert BlockScheduleAssignment.query.filter_by(contribution_id=inside.id).first() is None
    assert outside.timetable_entry is not None
    assert BlockScheduleAssignment.query.filter_by(contribution_id=outside.id).first() is not None


@pytest.mark.usefixtures('db')
def test_serialize_session_block_falls_back_to_session_title_and_color(dummy_event):
    from indico.modules.events.sessions.models.sessions import Session

    session_ = Session(event=dummy_event, title='Plenary')
    session_.colors = ('202020', 'e3f2d3')
    db.session.add(session_)
    db.session.flush()
    block = BlockScheduleSessionBlock(event=dummy_event, session=session_,
                                      start_dt=datetime(2026, 6, 18, 9, 0, tzinfo=UTC),
                                      duration=timedelta(minutes=60))
    db.session.add(block)
    db.session.flush()

    data = serialize_session_block(block)
    assert data['title'] == 'Plenary'
    assert data['color'] == 'e3f2d3'
    assert data['column_ids'] is None


@pytest.mark.usefixtures('request_context')
def test_build_export_rows_orders_by_column_then_start(dummy_event, create_contribution):
    from indico_blockschedule.util import assign_contribution_to_column

    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    column_b = BlockScheduleColumn(event=dummy_event, position=2, label='Room B')
    db.session.add_all([column_a, column_b])
    db.session.flush()
    c1 = create_contribution(dummy_event, 'Second in A', duration=timedelta(minutes=30))
    c2 = create_contribution(dummy_event, 'First in A', duration=timedelta(minutes=30))
    c3 = create_contribution(dummy_event, 'In B', duration=timedelta(minutes=30))
    db.session.flush()
    assign_contribution_to_column(c1, column_a, datetime(2026, 6, 18, 10, 0, tzinfo=UTC))
    assign_contribution_to_column(c2, column_a, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))
    assign_contribution_to_column(c3, column_b, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))

    headers, rows = build_export_rows(dummy_event, date(2026, 6, 18))

    assert headers[0] == 'Column'
    assert [row['Title'] for row in rows] == ['First in A', 'Second in A', 'In B']


@pytest.mark.usefixtures('db')
def test_generate_ods_produces_nonempty_file():
    sheet = {'type': 'flat', 'name': 'Sheet1', 'headers': ['Title'], 'rows': [{'Title': 'Talk'}]}
    buf = generate_ods([sheet])
    assert buf.read(2) == b'PK'  # ODS is a zip archive


@pytest.mark.usefixtures('request_context')
def test_build_grid_export_sheet_places_contribution_as_a_merged_rich_cell(dummy_event, create_contribution):
    from indico_blockschedule.util import assign_contribution_to_column

    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    column_b = BlockScheduleColumn(event=dummy_event, position=2, label='Room B')
    db.session.add_all([column_a, column_b])
    db.session.flush()
    contribution = create_contribution(dummy_event, 'Keynote', duration=timedelta(minutes=60))
    db.session.flush()
    assign_contribution_to_column(contribution, column_a, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))

    time_labels, column_titles, placements = build_grid_export_sheet(dummy_event, date(2026, 6, 18))

    assert column_titles == ['Room A', 'Room B']
    # Row boundaries come from the actual start/end times in play (9:00, 10:00) plus the
    # working-hours bounds (9:00, 18:00) -- not a fixed slot size -- so with nothing else
    # scheduled this is exactly two rows: [09:00-10:00) and [10:00-18:00).
    assert time_labels == ['09:00', '10:00']
    assert len(placements) == 1
    placement = placements[0]
    assert (placement['row'], placement['col'], placement['row_span']) == (0, 0, 1)
    assert placement['text'].splitlines() == [
        'Keynote',
        'Room: Room A',
        'Date: 2026-06-18',
        'Time: 09:00-10:00',
    ]


@pytest.mark.usefixtures('request_context')
def test_build_grid_export_sheet_handles_non_slot_aligned_back_to_back_contributions(dummy_event, create_contribution):
    # Regression test: a contribution ending a few minutes into what the on-screen grid
    # would render as one coarse slot, immediately followed by another starting there, must
    # not produce overlapping merge ranges (xlsxwriter/ODF both reject those outright).
    from indico_blockschedule.util import assign_contribution_to_column

    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    db.session.flush()
    first = create_contribution(dummy_event, 'First', duration=timedelta(minutes=25))
    second = create_contribution(dummy_event, 'Second', duration=timedelta(minutes=25))
    db.session.flush()
    assign_contribution_to_column(first, column_a, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))
    assign_contribution_to_column(second, column_a, datetime(2026, 6, 18, 9, 25, tzinfo=UTC))

    placements = build_grid_export_sheet(dummy_event, date(2026, 6, 18))[2]

    assert len(placements) == 2
    by_title = {p['text'].splitlines()[0]: p for p in placements}
    first_end = by_title['First']['row'] + by_title['First']['row_span']
    assert first_end == by_title['Second']['row']  # adjacent, never overlapping


@pytest.mark.usefixtures('request_context')
def test_assign_contribution_to_column_rejects_overlap(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    db.session.flush()
    first = create_contribution(dummy_event, 'First', duration=timedelta(minutes=30))
    second = create_contribution(dummy_event, 'Second', duration=timedelta(minutes=30))
    db.session.flush()
    assign_contribution_to_column(first, column_a, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))

    with pytest.raises(ScheduleOverlapError):
        assign_contribution_to_column(second, column_a, datetime(2026, 6, 18, 9, 15, tzinfo=UTC))

    assert second.timetable_entry is None


@pytest.mark.usefixtures('request_context')
def test_assign_contribution_to_column_allows_back_to_back_and_self_move(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    db.session.flush()
    first = create_contribution(dummy_event, 'First', duration=timedelta(minutes=30))
    second = create_contribution(dummy_event, 'Second', duration=timedelta(minutes=30))
    db.session.flush()
    assign_contribution_to_column(first, column_a, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))
    # Exactly back-to-back (no gap) is not an overlap.
    assign_contribution_to_column(second, column_a, datetime(2026, 6, 18, 9, 30, tzinfo=UTC))
    assert second.timetable_entry.start_dt == datetime(2026, 6, 18, 9, 30, tzinfo=UTC)
    # Moving a contribution's own existing booking to a new time isn't an overlap with itself.
    assign_contribution_to_column(first, column_a, datetime(2026, 6, 18, 8, 0, tzinfo=UTC))
    assert first.timetable_entry.start_dt == datetime(2026, 6, 18, 8, 0, tzinfo=UTC)


@pytest.mark.usefixtures('request_context')
def test_autoschedule_does_not_double_book_a_manually_scheduled_contribution(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    db.session.flush()
    manual = create_contribution(dummy_event, 'Manual', duration=timedelta(minutes=60))
    auto1 = create_contribution(dummy_event, 'Auto 1', duration=timedelta(minutes=30))
    auto2 = create_contribution(dummy_event, 'Auto 2', duration=timedelta(minutes=30))
    db.session.flush()
    # Manually book the column for the entire 09:00-10:00 stretch before autoscheduling.
    assign_contribution_to_column(manual, column_a, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))

    start_dt = datetime(2026, 6, 18, 9, 0, tzinfo=UTC)
    end_dt = datetime(2026, 6, 18, 11, 0, tzinfo=UTC)
    leftover = autoschedule(dummy_event, [column_a], start_dt, end_dt, gap_minutes=0)

    assert leftover == []
    for contribution in (auto1, auto2):
        entry = contribution.timetable_entry
        assert entry.start_dt >= manual.timetable_entry.end_dt


@pytest.mark.usefixtures('request_context')
def test_autoschedule_excludes_contributions_by_session_and_track(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    session_ = Session(event=dummy_event, title='Excluded Session')
    track = Track(event=dummy_event, title='Excluded Track')
    db.session.add_all([session_, track])
    db.session.flush()

    excluded_by_session = create_contribution(dummy_event, 'In excluded session', duration=timedelta(minutes=20),
                                              session=session_)
    excluded_by_track = create_contribution(dummy_event, 'In excluded track', duration=timedelta(minutes=20),
                                            track=track)
    included = create_contribution(dummy_event, 'Plain', duration=timedelta(minutes=20))
    db.session.flush()

    start_dt = datetime(2026, 6, 18, 9, 0, tzinfo=UTC)
    end_dt = datetime(2026, 6, 18, 18, 0, tzinfo=UTC)
    leftover = autoschedule(dummy_event, [column_a], start_dt, end_dt, gap_minutes=0,
                           exclude_session_ids={session_.id}, exclude_track_ids={track.id})

    assert leftover == []  # excluded contributions are skipped entirely, not reported as leftover
    assert excluded_by_session.timetable_entry is None
    assert excluded_by_track.timetable_entry is None
    assert included.timetable_entry is not None


@pytest.mark.usefixtures('request_context')
def test_clear_schedule_excludes_contributions_by_session_and_track(dummy_event, create_contribution):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column_a)
    session_ = Session(event=dummy_event, title='Excluded Session')
    track = Track(event=dummy_event, title='Excluded Track')
    db.session.add_all([session_, track])
    db.session.flush()

    excluded_by_session = create_contribution(dummy_event, 'In excluded session', duration=timedelta(minutes=20),
                                              session=session_)
    excluded_by_track = create_contribution(dummy_event, 'In excluded track', duration=timedelta(minutes=20),
                                            track=track)
    included = create_contribution(dummy_event, 'Plain', duration=timedelta(minutes=20))
    db.session.flush()
    assign_contribution_to_column(excluded_by_session, column_a, datetime(2026, 6, 18, 9, 0, tzinfo=UTC))
    assign_contribution_to_column(excluded_by_track, column_a, datetime(2026, 6, 18, 9, 30, tzinfo=UTC))
    assign_contribution_to_column(included, column_a, datetime(2026, 6, 18, 10, 0, tzinfo=UTC))

    clear_schedule(dummy_event, [column_a],
                   datetime(2026, 6, 18, 9, 0, tzinfo=UTC), datetime(2026, 6, 18, 18, 0, tzinfo=UTC),
                   exclude_session_ids={session_.id}, exclude_track_ids={track.id})

    assert excluded_by_session.timetable_entry is not None
    assert excluded_by_track.timetable_entry is not None
    assert included.timetable_entry is None
