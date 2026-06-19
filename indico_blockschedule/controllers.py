# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

import re
from datetime import UTC, datetime, time, timedelta

from flask import jsonify, request, session
from webargs import fields
from webargs.flaskparser import use_kwargs
from werkzeug.exceptions import BadRequest

from indico.core.config import config
from indico.core.db import db
from indico.modules.events.contributions.models.contributions import Contribution
from indico.modules.events.controllers.base import RHDisplayEventBase
from indico.modules.events.management.controllers.base import RHManageEventBase
from indico.modules.events.timetable.models.entries import TimetableEntryType
from indico.modules.events.timetable.operations import create_break_entry, delete_timetable_entry, update_break_entry
from indico.modules.events.util import track_time_changes
from indico.modules.rb.models.rooms import Room

from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.util import (assign_contribution_to_column, autoschedule, get_spanning_blocks,
                                       get_unscheduled_contributions, serialize_column, serialize_contribution,
                                       serialize_spanning_block)
from indico_blockschedule.views import WPDisplayBlockSchedule, WPManageBlockSchedule


_HEX_COLOR_RE = re.compile(r'^[0-9a-fA-F]{6}$')


def _validate_color(color):
    if color is None:
        return None
    color = color.strip().removeprefix('#')
    if not _HEX_COLOR_RE.match(color):
        raise BadRequest('color must be a 6-digit hex string')
    return color.lower()


def _readable_text_color(background_hex):
    r, g, b = (int(background_hex[i:i + 2], 16) for i in (0, 2, 4))
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return '202020' if luminance > 0.6 else 'ffffff'


def _event_day(event, day_str):
    if day_str:
        try:
            day = datetime.strptime(day_str, '%Y-%m-%d').date()
        except ValueError:
            raise BadRequest('Invalid day')
    else:
        day = event.start_dt_local.date()
    if not (event.start_dt_local.date() <= day <= event.end_dt_local.date()):
        raise BadRequest('Day outside event range')
    return day


def _combine_local(event, day, minutes):
    naive = datetime.combine(day, time(hour=minutes // 60, minute=minutes % 60))
    return event.tzinfo.localize(naive).astimezone(UTC)


def _grid_payload(event, day, user=None):
    from indico_blockschedule.plugin import BlockschedulePlugin
    columns = (BlockScheduleColumn.query
              .with_parent(event)
              .order_by(BlockScheduleColumn.position)
              .all())
    scheduled = [c for c in event.contributions
                if not c.is_deleted and c.timetable_entry is not None
                and c.timetable_entry.start_dt.astimezone(event.tzinfo).date() == day]
    unscheduled = get_unscheduled_contributions(event)
    settings = BlockschedulePlugin.event_settings.get_all(event)
    spanning_blocks = get_spanning_blocks(event, day)
    return {
        'day': day.isoformat(),
        'event_days': [d.isoformat() for d in event.iter_days()],
        'columns': [serialize_column(c) for c in columns],
        'roombooking_enabled': config.ENABLE_ROOMBOOKING,
        'rooms': ([{'id': r.id, 'full_name': r.full_name} for r in Room.query.filter_by(is_deleted=False)]
                 if config.ENABLE_ROOMBOOKING else []),
        'scheduled_contributions': [serialize_contribution(c, user) for c in scheduled],
        'unscheduled_contributions': [serialize_contribution(c, user) for c in unscheduled],
        'spanning_blocks': [serialize_spanning_block(e) for e in spanning_blocks],
        'slot_minutes': settings['slot_minutes'],
        'day_start_time': settings['day_start_time'],
        'day_end_time': settings['day_end_time'],
        'gap_minutes': settings['gap_minutes'],
    }


class RHBlockScheduleManageBase(RHManageEventBase):
    pass


class RHManageBlockSchedule(RHBlockScheduleManageBase):
    def _process(self):
        return WPManageBlockSchedule.render_template('manage.html', self.event)


class RHManageGridData(RHBlockScheduleManageBase):
    def _process(self):
        day = _event_day(self.event, request.args.get('day'))
        return jsonify(_grid_payload(self.event, day, session.user))


class RHColumnCreate(RHBlockScheduleManageBase):
    @use_kwargs({
        'room_id': fields.Int(load_default=None),
        'label': fields.Str(load_default=None),
        'color': fields.Str(load_default=None),
    })
    def _process_POST(self, room_id, label, color):
        room = None
        if room_id is not None:
            room = Room.query.filter_by(id=room_id, is_deleted=False).first_or_404()
        label = (label or '').strip()
        if not label:
            if room is None:
                raise BadRequest('label is required when no room is selected')
            label = room.full_name
        max_position = (db.session.query(db.func.max(BlockScheduleColumn.position))
                        .filter(BlockScheduleColumn.event_id == self.event.id)
                        .scalar())
        column = BlockScheduleColumn(event=self.event, room=room, label=label, color=_validate_color(color),
                                     position=(max_position or 0) + 1)
        db.session.add(column)
        db.session.flush()
        return jsonify(serialize_column(column))


class RHColumnDeleteUpdate(RHBlockScheduleManageBase):
    def _process_args(self):
        RHBlockScheduleManageBase._process_args(self)
        self.column = (BlockScheduleColumn.query
                       .filter_by(id=request.view_args['column_id'], event_id=self.event.id)
                       .first_or_404())

    @use_kwargs({
        'label': fields.Str(load_default=None),
        'position': fields.Int(load_default=None),
        'color': fields.Str(load_default=None, allow_none=True),
    })
    def _process_PATCH(self, label, position, color):
        if label is not None:
            label = label.strip()
            if not label:
                raise BadRequest('label cannot be empty')
            self.column.label = label
        if position is not None:
            self.column.position = position
        if color is not None:
            self.column.color = _validate_color(color) if color else None
        db.session.flush()
        return jsonify(serialize_column(self.column))

    def _process_DELETE(self):
        for assignment in list(self.column.assignments):
            contribution = assignment.contribution
            if contribution.timetable_entry is not None:
                delete_timetable_entry(contribution.timetable_entry)
        db.session.delete(self.column)
        db.session.flush()
        return jsonify(success=True)


class RHColumnReorder(RHBlockScheduleManageBase):
    @use_kwargs({
        'column_ids': fields.List(fields.Int(), required=True),
    })
    def _process_POST(self, column_ids):
        columns = BlockScheduleColumn.query.filter_by(event_id=self.event.id).all()
        if {c.id for c in columns} != set(column_ids):
            raise BadRequest('column_ids must list every column of this event exactly once')
        columns_by_id = {c.id: c for c in columns}
        # Two-phase reassignment: the `(event_id, position)` unique constraint would otherwise
        # trip mid-update since the new positions overlap with existing ones.
        for index, column_id in enumerate(column_ids):
            columns_by_id[column_id].position = -(index + 1)
        db.session.flush()
        for index, column_id in enumerate(column_ids):
            columns_by_id[column_id].position = index + 1
        db.session.flush()
        return jsonify(columns=[serialize_column(columns_by_id[cid]) for cid in column_ids])


class RHScheduleContribution(RHBlockScheduleManageBase):
    @use_kwargs({
        'contribution_id': fields.Int(required=True),
        'column_id': fields.Int(required=True),
        'day': fields.Date(required=True),
        'start_minutes': fields.Int(required=True),
    })
    def _process_POST(self, contribution_id, column_id, day, start_minutes):
        contribution = Contribution.query.filter_by(id=contribution_id, event_id=self.event.id).first_or_404()
        column = BlockScheduleColumn.query.filter_by(id=column_id, event_id=self.event.id).first_or_404()
        start_dt = _combine_local(self.event, day, start_minutes)
        assign_contribution_to_column(contribution, column, start_dt)
        return jsonify(serialize_contribution(contribution, session.user))


class RHUnscheduleContribution(RHBlockScheduleManageBase):
    @use_kwargs({
        'contribution_id': fields.Int(required=True),
    })
    def _process_POST(self, contribution_id):
        contribution = Contribution.query.filter_by(id=contribution_id, event_id=self.event.id).first_or_404()
        if contribution.timetable_entry is not None:
            delete_timetable_entry(contribution.timetable_entry)
        if contribution.blockschedule_assignment is not None:
            db.session.delete(contribution.blockschedule_assignment)
        db.session.flush()
        return jsonify(serialize_contribution(contribution, session.user))


class RHGapSettingsUpdate(RHBlockScheduleManageBase):
    @use_kwargs({
        'gap_minutes': fields.Int(required=True),
    })
    def _process_PATCH(self, gap_minutes):
        from indico_blockschedule.plugin import BlockschedulePlugin
        if gap_minutes < 0:
            raise BadRequest('gap_minutes cannot be negative')
        BlockschedulePlugin.event_settings.set(self.event, 'gap_minutes', gap_minutes)
        return jsonify(gap_minutes=gap_minutes)


class RHAutoSchedule(RHBlockScheduleManageBase):
    @use_kwargs({
        'start_day': fields.Str(required=True),
        'start_minutes': fields.Int(required=True),
        'end_day': fields.Str(required=True),
        'end_minutes': fields.Int(required=True),
    })
    def _process_POST(self, start_day, start_minutes, end_day, end_minutes):
        from indico_blockschedule.plugin import BlockschedulePlugin
        start_dt = _combine_local(self.event, _event_day(self.event, start_day), start_minutes)
        end_dt = _combine_local(self.event, _event_day(self.event, end_day), end_minutes)
        if end_dt <= start_dt:
            raise BadRequest('End must be after start')
        columns = (BlockScheduleColumn.query
                  .with_parent(self.event)
                  .order_by(BlockScheduleColumn.position)
                  .all())
        if not columns:
            raise BadRequest('Add at least one column before autoscheduling')
        gap_minutes = BlockschedulePlugin.event_settings.get(self.event, 'gap_minutes')
        leftover = autoschedule(self.event, columns, start_dt, end_dt, gap_minutes)
        return jsonify(unscheduled_count=len(leftover),
                       unscheduled_titles=[c.title for c in leftover])


class RHSpanningBlockCreate(RHBlockScheduleManageBase):
    @use_kwargs({
        'title': fields.Str(required=True),
        'day': fields.Str(required=True),
        'start_minutes': fields.Int(required=True),
        'duration_minutes': fields.Int(required=True),
        'color': fields.Str(load_default=None),
    })
    def _process_POST(self, title, day, start_minutes, duration_minutes, color):
        title = title.strip()
        if not title:
            raise BadRequest('title is required')
        if duration_minutes <= 0:
            raise BadRequest('duration_minutes must be positive')
        start_dt = _combine_local(self.event, _event_day(self.event, day), start_minutes)
        color = _validate_color(color) or 'e0e0e0'
        entry = create_break_entry(self.event, {
            'title': title,
            'duration': timedelta(minutes=duration_minutes),
            'start_dt': start_dt,
            'text_color': _readable_text_color(color),
            'background_color': color,
        })
        return jsonify(serialize_spanning_block(entry))


class RHSpanningBlockDeleteUpdate(RHBlockScheduleManageBase):
    def _process_args(self):
        RHBlockScheduleManageBase._process_args(self)
        self.entry = (self.event.timetable_entries
                     .filter_by(id=request.view_args['entry_id'], parent_id=None, type=TimetableEntryType.BREAK)
                     .first_or_404())

    @use_kwargs({
        'title': fields.Str(load_default=None),
        'day': fields.Str(load_default=None),
        'start_minutes': fields.Int(load_default=None),
        'duration_minutes': fields.Int(load_default=None),
        'color': fields.Str(load_default=None),
    })
    def _process_PATCH(self, title, day, start_minutes, duration_minutes, color):
        data = {}
        if title is not None:
            title = title.strip()
            if not title:
                raise BadRequest('title cannot be empty')
            data['title'] = title
        if day is not None and start_minutes is not None:
            data['start_dt'] = _combine_local(self.event, _event_day(self.event, day), start_minutes)
        if duration_minutes is not None:
            if duration_minutes <= 0:
                raise BadRequest('duration_minutes must be positive')
            data['duration'] = timedelta(minutes=duration_minutes)
        if color is not None:
            color = _validate_color(color) or 'e0e0e0'
            data['background_color'] = color
            data['text_color'] = _readable_text_color(color)
        with track_time_changes():
            update_break_entry(self.entry.break_, data)
        return jsonify(serialize_spanning_block(self.entry))

    def _process_DELETE(self):
        delete_timetable_entry(self.entry)
        return jsonify(success=True)


class RHDisplayBlockSchedule(RHDisplayEventBase):
    def _process(self):
        return WPDisplayBlockSchedule.render_template('display.html', self.event)


class RHDisplayGridData(RHDisplayEventBase):
    def _process(self):
        day = _event_day(self.event, request.args.get('day'))
        return jsonify(_grid_payload(self.event, day, session.user))
