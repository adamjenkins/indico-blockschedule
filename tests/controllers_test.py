# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico_blockschedule.controllers import _day_bounds, _grid_payload, _minutes_to_hhmm
from indico_blockschedule.plugin import BlockschedulePlugin


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
