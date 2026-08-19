# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from datetime import UTC, date, datetime, timedelta

import pytest
from werkzeug.exceptions import BadRequest

from indico_blockschedule.controllers import _combine_local, _day_bounds, _day_windows, _grid_payload, _minutes_to_hhmm
from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.models.session_blocks import BlockScheduleSessionBlock
from indico_blockschedule.plugin import BlockschedulePlugin


@pytest.fixture
def manage_client(db, dummy_event, dummy_user, test_client):
    """A test client logged in as a manager of `dummy_event`, with the feature on."""
    from indico.modules.events.features.util import set_feature_enabled

    set_feature_enabled(dummy_event, 'blockschedule', True)
    dummy_event.update_principal(dummy_user, full_access=True)
    db.session.flush()
    with test_client.session_transaction() as sess:
        sess.set_session_user(dummy_user)
    return test_client


def test_minutes_to_hhmm():
    assert _minutes_to_hhmm(0) == '00:00'
    assert _minutes_to_hhmm(90) == '01:30'
    assert _minutes_to_hhmm(24 * 60) == '24:00'


def test_day_bounds_falls_back_to_settings_when_nothing_scheduled():
    settings = {'day_start_time': '09:00', 'day_end_time': '18:00'}
    assert _day_bounds([], [], 30, settings) == ('09:00', '18:00')


def test_day_bounds_spans_first_start_to_last_end_rounded_to_slots():
    scheduled = [
        {'start_minutes': 545, 'duration_minutes': 20},  # 09:05-09:25
        {'start_minutes': 600, 'duration_minutes': 90},  # 10:00-11:30
    ]
    settings = {'day_start_time': '09:00', 'day_end_time': '18:00'}
    assert _day_bounds(scheduled, [], 30, settings) == ('09:00', '11:30')


def test_day_bounds_includes_spanning_blocks():
    scheduled = [{'start_minutes': 600, 'duration_minutes': 30}]  # 10:00-10:30
    spanning_blocks = [{'start_minutes': 480, 'duration_minutes': 60}]  # 08:00-09:00
    settings = {'day_start_time': '09:00', 'day_end_time': '18:00'}
    assert _day_bounds(scheduled, spanning_blocks, 30, settings) == ('08:00', '10:30')


def test_day_bounds_rounds_up_a_ragged_end_to_the_next_slot():
    scheduled = [{'start_minutes': 540, 'duration_minutes': 25}]  # 09:00-09:25
    settings = {'day_start_time': '09:00', 'day_end_time': '18:00'}
    assert _day_bounds(scheduled, [], 30, settings) == ('09:00', '09:30')


def test_grid_payload_carries_the_title_line_limit(dummy_event):
    # The app and the display page both clamp titles from this key; it is part of the payload
    # contract, so its absence should fail here rather than silently unclamp every title.
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date())
    assert payload['title_max_lines'] == 3


def test_grid_payload_title_line_limit_follows_the_event_setting(dummy_event):
    BlockschedulePlugin.event_settings.set(dummy_event, 'title_max_lines', 0)
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date())
    assert payload['title_max_lines'] == 0


def test_grid_payload_carries_track_colours(dummy_event, db):
    from indico.modules.events.tracks.models.tracks import Track

    track = Track(event=dummy_event, title='Pragmatics')
    db.session.flush()
    BlockschedulePlugin.event_settings.set(dummy_event, 'track_colors', {str(track.id): 'c0392b'})
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date())
    assert payload['tracks'] == [{'id': track.id, 'title': 'Pragmatics', 'color': 'c0392b'}]


def test_grid_payload_leaves_uncoloured_tracks_null(dummy_event, db):
    from indico.modules.events.tracks.models.tracks import Track

    Track(event=dummy_event, title='Vocabulary Acquisition')
    db.session.flush()
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date())
    # Not an empty string and not the default colour: the frontend distinguishes "no choice
    # made" from "chosen", and only the former falls back to the stylesheet.
    assert payload['tracks'][0]['color'] is None


def test_grid_payload_carries_no_logo_url_when_none_is_set(dummy_event):
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date())
    # None rather than an empty string: the app treats "no logo" and "a logo that
    # would not load" differently, and only one of them is worth a placeholder.
    assert payload['event_logo_url'] is None


def test_grid_payload_carries_the_event_logo_url(dummy_event, db):
    dummy_event.logo = b'not really a png'
    dummy_event.logo_metadata = {'hash': 'abc123', 'size': 16, 'filename': 'logo.png',
                                 'content_type': 'image/png'}
    db.session.flush()
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date())
    # The hash is in the URL, so a replaced logo is a different address and no
    # cached copy anywhere can go stale.
    assert payload['event_logo_url'] is not None
    assert 'abc123' in payload['event_logo_url']


def test_the_display_payload_hides_a_contribution_the_viewer_cannot_see(db, dummy_event,
                                                                        dummy_contribution,
                                                                        request_context):
    from indico.core.db.sqlalchemy.protection import ProtectionMode

    from indico_blockschedule.util import event_contributions

    dummy_event.protection_mode = ProtectionMode.public
    dummy_contribution.protection_mode = ProtectionMode.protected
    db.session.flush()

    # An event being public does not make every contribution in it public, and
    # this payload is what the phone app caches onto an attendee's device.
    assert dummy_contribution not in event_contributions(dummy_event, accessible_only=True)
    assert dummy_contribution in event_contributions(dummy_event)


def test_the_management_payload_still_shows_everything(db, dummy_event, dummy_contribution,
                                                       request_context):
    from indico.core.db.sqlalchemy.protection import ProtectionMode

    dummy_contribution.protection_mode = ProtectionMode.protected
    db.session.flush()
    # A manager arranging the grid has to see the talks they are arranging.
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date(), full_day=True)
    titles = [c['title'] for c in payload['unscheduled_contributions']]
    assert dummy_contribution.title in titles


def test_the_display_payload_omits_rooms_and_unscheduled(dummy_event):
    # Neither key is read by the display page or the phone app, and both are the
    # payload's most sensitive parts: `rooms` is an instance-wide directory once Room
    # Booking is on, and the unscheduled list is invisible on the display grid anyway.
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date(), manage=False)
    assert 'rooms' not in payload
    assert 'unscheduled_contributions' not in payload


def test_the_management_payload_keeps_rooms_and_unscheduled(dummy_event):
    payload = _grid_payload(dummy_event, dummy_event.start_dt.date(), full_day=True)
    assert payload['rooms'] == []
    assert payload['unscheduled_contributions'] == []


def test_combine_local_rejects_out_of_range_minutes(dummy_event):
    for minutes in (-30, 24 * 60 + 1, 99999):
        with pytest.raises(BadRequest):
            _combine_local(dummy_event, date(2026, 6, 18), minutes)
    # 24:00 stays valid as an end-of-day bound and means the following midnight.
    assert _combine_local(dummy_event, date(2026, 6, 18), 24 * 60) == datetime(2026, 6, 19, 0, 0, tzinfo=UTC)


def test_day_windows_clips_each_day_to_working_hours(dummy_event):
    first, last = date(2026, 6, 18), date(2026, 6, 19)
    # The caller asks for 08:00 on day one to 12:00 on day two; working hours are
    # 09:00-18:00 and clip the early start on the first day.
    windows = _day_windows(dummy_event, first, 8 * 60, last, 12 * 60, 9 * 60, 18 * 60)
    assert windows == [
        (datetime(2026, 6, 18, 9, 0, tzinfo=UTC), datetime(2026, 6, 18, 18, 0, tzinfo=UTC)),
        (datetime(2026, 6, 19, 9, 0, tzinfo=UTC), datetime(2026, 6, 19, 12, 0, tzinfo=UTC)),
    ]


def test_day_windows_drops_a_day_with_no_time_inside_working_hours(dummy_event):
    first, last = date(2026, 6, 18), date(2026, 6, 19)
    # A first day starting after working hours end contributes no window at all.
    windows = _day_windows(dummy_event, first, 19 * 60, last, 18 * 60, 9 * 60, 18 * 60)
    assert windows == [
        (datetime(2026, 6, 19, 9, 0, tzinfo=UTC), datetime(2026, 6, 19, 18, 0, tzinfo=UTC)),
    ]


@pytest.mark.usefixtures('no_csrf_check')
def test_out_of_range_start_minutes_is_a_400_not_a_500(manage_client, dummy_event, dummy_contribution, db):
    column = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column)
    db.session.flush()
    resp = manage_client.post(f'/event/{dummy_event.id}/manage/block-schedule/schedule',
                              json={'contribution_id': dummy_contribution.id, 'column_id': column.id,
                                    'day': dummy_event.start_dt_local.date().isoformat(),
                                    'start_minutes': 99999})
    assert resp.status_code == 400


@pytest.mark.usefixtures('no_csrf_check')
def test_settings_update_accepts_working_hours_and_slot_size(manage_client, dummy_event):
    resp = manage_client.patch(f'/event/{dummy_event.id}/manage/block-schedule/settings',
                               json={'day_start_time': '08:30', 'day_end_time': '19:30', 'slot_minutes': 15})
    assert resp.status_code == 200
    assert resp.json['day_start_time'] == '08:30'
    assert resp.json['day_end_time'] == '19:30'
    assert resp.json['slot_minutes'] == 15
    settings = BlockschedulePlugin.event_settings.get_all(dummy_event)
    assert (settings['day_start_time'], settings['day_end_time'], settings['slot_minutes']) == ('08:30', '19:30', 15)


@pytest.mark.usefixtures('no_csrf_check')
@pytest.mark.parametrize('payload', (
    {'day_start_time': '19:00'},   # after the stored end (18:00)
    {'day_end_time': '08:00'},     # before the stored start (09:00)
    {'day_start_time': '18:00', 'day_end_time': '09:00'},
    {'day_start_time': 'noonish'},
    {'day_start_time': '09:75'},
    {'day_end_time': '25:00'},
    {'slot_minutes': 0},
    {'slot_minutes': 300},
))
def test_settings_update_rejects_a_broken_working_hours_window(manage_client, dummy_event, payload):
    resp = manage_client.patch(f'/event/{dummy_event.id}/manage/block-schedule/settings', json=payload)
    assert resp.status_code == 400
    settings = BlockschedulePlugin.event_settings.get_all(dummy_event)
    assert (settings['day_start_time'], settings['day_end_time'], settings['slot_minutes']) == ('09:00', '18:00', 30)


@pytest.mark.usefixtures('no_csrf_check')
def test_column_patch_no_longer_accepts_position(manage_client, dummy_event, db):
    # Reordering goes through the reorder endpoint's two-phase dance; a raw position
    # write here would trip the `(event_id, position)` unique constraint.
    column = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    db.session.add(column)
    db.session.flush()
    resp = manage_client.patch(f'/event/{dummy_event.id}/manage/block-schedule/columns/{column.id}',
                               json={'position': 5})
    assert resp.status_code == 422
    assert column.position == 1


@pytest.mark.usefixtures('no_csrf_check')
def test_column_delete_prunes_session_block_column_ids(manage_client, dummy_event, db):
    column_a = BlockScheduleColumn(event=dummy_event, position=1, label='Room A')
    column_b = BlockScheduleColumn(event=dummy_event, position=2, label='Room B')
    db.session.add_all([column_a, column_b])
    db.session.flush()
    start_dt = datetime(2026, 6, 18, 9, 0, tzinfo=UTC)
    both = BlockScheduleSessionBlock(event=dummy_event, title='Both', start_dt=start_dt,
                                     duration=timedelta(minutes=60), column_ids=[column_a.id, column_b.id])
    only_a = BlockScheduleSessionBlock(event=dummy_event, title='Only A', start_dt=start_dt,
                                       duration=timedelta(minutes=60), column_ids=[column_a.id])
    everywhere = BlockScheduleSessionBlock(event=dummy_event, title='Everywhere', start_dt=start_dt,
                                           duration=timedelta(minutes=60), column_ids=None)
    db.session.add_all([both, only_a, everywhere])
    db.session.flush()

    resp = manage_client.delete(f'/event/{dummy_event.id}/manage/block-schedule/columns/{column_a.id}')

    assert resp.status_code == 200
    # The banner spanning both columns shrinks; the one spanning only the deleted
    # column would render nowhere (and have no delete control), so it goes too; a
    # NULL list means "every column" and is left alone.
    assert both.column_ids == [column_b.id]
    assert BlockScheduleSessionBlock.query.filter_by(id=only_a.id).first() is None
    assert everywhere.column_ids is None


def test_grid_data_serves_etags_and_a_304_on_matching_if_none_match(manage_client, dummy_event):
    url = f'/event/{dummy_event.id}/manage/block-schedule/grid-data'
    first = manage_client.get(url)
    assert first.status_code == 200
    etag = first.headers['ETag']
    assert 'must-revalidate' in first.headers['Cache-Control']
    again = manage_client.get(url, headers={'If-None-Match': etag})
    assert again.status_code == 304
    assert not again.data


def test_display_grid_data_serves_etags_too(manage_client, dummy_event):
    resp = manage_client.get(f'/event/{dummy_event.id}/block-schedule/grid-data')
    assert resp.status_code == 200
    assert resp.headers.get('ETag')
