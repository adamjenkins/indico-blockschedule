# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from flask import session
from wtforms.fields import BooleanField

from indico.core import signals
from indico.core.plugins import IndicoPlugin, url_for_plugin
from indico.modules.events.features.base import EventFeature
from indico.modules.events.layout.util import MenuEntryData
from indico.web.forms.base import IndicoForm
from indico.web.forms.widgets import SwitchWidget
from indico.web.menu import SideMenuItem

from indico_blockschedule import _
from indico_blockschedule.blueprint import blueprint
from indico_blockschedule.models.columns import BlockScheduleColumn


#: The name of the event feature this plugin is gated behind. Also referenced by
#: `blueprint.py`, which uses it to 404 every URL the plugin owns when it is off.
FEATURE_NAME = 'blockschedule'


class SettingsForm(IndicoForm):
    enabled_by_default = BooleanField(_('Enabled by default'), widget=SwitchWidget(),
                                      description=_('Turn the Block Schedule feature on for new events without a '
                                                    'manager having to enable it. Events where a feature has already '
                                                    'been switched on or off keep whatever they were set to.'))


class BlockschedulePlugin(IndicoPlugin):
    """Block Schedule

    A simpler, grid-based timetable: time down the rows, rooms across the
    columns, with drag-and-drop scheduling.
    """

    configurable = True
    settings_form = SettingsForm

    default_settings = {
        'enabled_by_default': False,
    }

    default_event_settings = {
        'slot_minutes': 30,
        'day_start_time': '09:00',
        'day_end_time': '18:00',
        'gap_minutes': 0,
        'snap_minutes': 5,
        'row_height_px': 60,
        'show_session_track': True,
        'description_display': 'hidden',
        'title_max_lines': 3,
        # Track id (as a string, since settings are stored as JSON) -> 'rrggbb'.
        'track_colors': {},
    }

    def init(self):
        super().init()
        self.connect(signals.event.get_feature_definitions, self._get_feature_definitions)
        self.connect(signals.menu.items, self._add_management_sidemenu_item, sender='event-management-sidemenu')
        self.connect(signals.event.sidemenu, self._add_display_sidemenu_item)

    def _get_feature_definitions(self, sender, **kwargs):
        return BlockScheduleFeature

    def _add_management_sidemenu_item(self, sender, event, **kwargs):
        if not event.can_manage(session.user) or not event.has_feature(FEATURE_NAME):
            return
        return SideMenuItem('blockschedule', _('Block Schedule'), url_for_plugin('blockschedule.manage', event),
                            weight=79, icon='grid')

    def _add_display_sidemenu_item(self, sender, **kwargs):
        # `visible` rather than withholding the entry from the signal: an entry that stops
        # being returned is one core removes from the event's layout menu, taking any
        # position or renaming a manager had applied with it. `visible` leaves the entry in
        # place and merely hides it, so turning the feature back on restores what was there.
        return MenuEntryData(title=_('Block Schedule'), name='blockschedule', endpoint='blockschedule.display',
                             position=3, visible=lambda event: event.has_feature(FEATURE_NAME))

    def get_blueprints(self):
        return blueprint


class BlockScheduleFeature(EventFeature):
    name = FEATURE_NAME
    friendly_name = _('Block Schedule')
    description = _('Gives event managers a grid-based timetable: time down the rows, rooms across the columns.')

    @classmethod
    def is_default_for_event(cls, event):
        # Off for a new event, unless an admin has said otherwise -- but on for an event that
        # already has a grid built. Without that second case, installing this version would
        # take every existing schedule off its event menu until somebody went looking for the
        # switch, which is not an upgrade anyone asked for.
        #
        # Note this is only consulted while an event has no explicit feature list at all
        # (core's `get_enabled_features`): the first time *any* feature is toggled on an
        # event, the whole set is written out and no default applies to that event again.
        if BlockschedulePlugin.settings.get('enabled_by_default'):
            return True
        return BlockScheduleColumn.query.filter_by(event_id=event.id).has_rows()
