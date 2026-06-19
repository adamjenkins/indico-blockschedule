# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico_blockschedule.controllers import _day_bounds, _minutes_to_hhmm


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
