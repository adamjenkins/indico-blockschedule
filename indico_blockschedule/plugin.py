# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from flask import session

from indico.core import signals
from indico.core.plugins import IndicoPlugin, url_for_plugin
from indico.modules.events.layout.util import MenuEntryData
from indico.web.menu import SideMenuItem

from indico_blockschedule import _
from indico_blockschedule.blueprint import blueprint


class BlockschedulePlugin(IndicoPlugin):
    """Block Schedule

    A simpler, grid-based timetable: time down the rows, rooms across the
    columns, with drag-and-drop scheduling.
    """

    default_event_settings = {
        'slot_minutes': 30,
        'day_start_time': '09:00',
        'day_end_time': '18:00',
        'gap_minutes': 0,
    }

    def init(self):
        super().init()
        self.connect(signals.menu.items, self._add_management_sidemenu_item, sender='event-management-sidemenu')
        self.connect(signals.event.sidemenu, self._add_display_sidemenu_item)

    def _add_management_sidemenu_item(self, sender, event, **kwargs):
        if not event.can_manage(session.user):
            return
        return SideMenuItem('blockschedule', _('Block Schedule'), url_for_plugin('blockschedule.manage', event),
                            section='organization')

    def _add_display_sidemenu_item(self, sender, **kwargs):
        return MenuEntryData(title=_('Block Schedule'), name='blockschedule', endpoint='blockschedule.display',
                             position=3)

    def get_blueprints(self):
        return blueprint
