# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico.core.plugins import IndicoPluginBlueprint

from indico_blockschedule.controllers import (RHColumnCreate, RHColumnDeleteUpdate, RHDisplayBlockSchedule,
                                              RHDisplayGridData, RHManageBlockSchedule, RHManageGridData,
                                              RHScheduleContribution, RHUnscheduleContribution)


blueprint = IndicoPluginBlueprint('blockschedule', __name__)

blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/', 'manage', RHManageBlockSchedule)
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/grid-data', 'manage_grid_data', RHManageGridData)
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/columns', 'columns_create', RHColumnCreate,
                       methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/columns/<int:column_id>',
                       'columns_delete_update', RHColumnDeleteUpdate, methods=('PATCH', 'DELETE'))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/schedule', 'schedule', RHScheduleContribution,
                       methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/unschedule', 'unschedule',
                       RHUnscheduleContribution, methods=('POST',))

blueprint.add_url_rule('/event/<int:event_id>/block-schedule/', 'display', RHDisplayBlockSchedule)
blueprint.add_url_rule('/event/<int:event_id>/block-schedule/grid-data', 'display_grid_data', RHDisplayGridData)
