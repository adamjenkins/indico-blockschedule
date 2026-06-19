# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from datetime import UTC, datetime, timedelta

import pytest

from indico.modules.events.timetable.operations import create_break_entry, update_break_entry
from indico.modules.events.util import track_time_changes


@pytest.mark.usefixtures('request_context')
def test_rescheduling_a_spanning_block_does_not_crash(dummy_event):
    """Regression test: moving a spanning block (a top-level `Break` entry) requires
    `track_time_changes()` around the `start_dt` update, since `TimetableEntry`'s
    `start_dt` setter raises if a change isn't being tracked.
    """
    entry = create_break_entry(dummy_event, {
        'title': 'Lunch Break',
        'duration': timedelta(minutes=60),
        'start_dt': datetime(2026, 6, 18, 12, 0, tzinfo=UTC),
    })

    with track_time_changes():
        update_break_entry(entry.break_, {'start_dt': datetime(2026, 6, 18, 12, 30, tzinfo=UTC)})

    assert entry.start_dt == datetime(2026, 6, 18, 12, 30, tzinfo=UTC)
