# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.plugin import BlockScheduleFeature, BlockschedulePlugin


def test_feature_is_off_for_a_new_event(dummy_event):
    assert not BlockScheduleFeature.is_default_for_event(dummy_event)


def test_feature_is_on_for_an_event_that_already_has_a_grid(dummy_event, db):
    # The upgrade case: a site running an older version has schedules already built, and
    # they must not vanish from their events' menus the moment this version is installed.
    db.session.add(BlockScheduleColumn(event_id=dummy_event.id, label='9F-01', position=0))
    db.session.flush()
    assert BlockScheduleFeature.is_default_for_event(dummy_event)


def test_admin_setting_turns_the_feature_on_for_new_events(dummy_event):
    BlockschedulePlugin.settings.set('enabled_by_default', True)
    assert BlockScheduleFeature.is_default_for_event(dummy_event)
