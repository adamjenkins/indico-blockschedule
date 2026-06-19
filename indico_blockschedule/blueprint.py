# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico.core.plugins import IndicoPluginBlueprint

from indico_blockschedule.controllers import (RHAutoSchedule, RHColumnCreate, RHColumnDeleteUpdate, RHColumnReorder,
                                              RHDisplayBlockSchedule, RHDisplayGridData, RHGapSettingsUpdate,
                                              RHManageBlockSchedule, RHManageGridData, RHScheduleContribution,
                                              RHSpanningBlockCreate, RHSpanningBlockDeleteUpdate,
                                              RHUnscheduleContribution)


blueprint = IndicoPluginBlueprint('blockschedule', __name__)

blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/', 'manage', RHManageBlockSchedule)
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/grid-data', 'manage_grid_data', RHManageGridData)
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/columns', 'columns_create', RHColumnCreate,
                       methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/columns/<int:column_id>',
                       'columns_delete_update', RHColumnDeleteUpdate, methods=('PATCH', 'DELETE'))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/columns/reorder', 'columns_reorder',
                       RHColumnReorder, methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/schedule', 'schedule', RHScheduleContribution,
                       methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/unschedule', 'unschedule',
                       RHUnscheduleContribution, methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/settings', 'settings_update',
                       RHGapSettingsUpdate, methods=('PATCH',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/autoschedule', 'autoschedule', RHAutoSchedule,
                       methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/spanning-blocks', 'spanning_blocks_create',
                       RHSpanningBlockCreate, methods=('POST',))
blueprint.add_url_rule('/event/<int:event_id>/manage/block-schedule/spanning-blocks/<int:entry_id>',
                       'spanning_blocks_delete_update', RHSpanningBlockDeleteUpdate, methods=('PATCH', 'DELETE'))

blueprint.add_url_rule('/event/<int:event_id>/block-schedule/', 'display', RHDisplayBlockSchedule)
blueprint.add_url_rule('/event/<int:event_id>/block-schedule/grid-data', 'display_grid_data', RHDisplayGridData)
