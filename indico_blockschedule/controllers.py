# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from datetime import UTC, datetime, time

from flask import jsonify, request, session
from webargs import fields
from webargs.flaskparser import use_kwargs
from werkzeug.exceptions import BadRequest

from indico.core.config import config
from indico.core.db import db
from indico.modules.events.contributions.models.contributions import Contribution
from indico.modules.events.controllers.base import RHDisplayEventBase
from indico.modules.events.management.controllers.base import RHManageEventBase
from indico.modules.events.timetable.operations import (delete_timetable_entry, schedule_contribution,
                                                        update_timetable_entry)
from indico.modules.events.util import track_location_changes, track_time_changes
from indico.modules.rb.models.rooms import Room

from indico_blockschedule.models.assignments import BlockScheduleAssignment
from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.util import get_unscheduled_contributions, serialize_column, serialize_contribution
from indico_blockschedule.views import WPDisplayBlockSchedule, WPManageBlockSchedule


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
    return {
        'day': day.isoformat(),
        'event_days': [d.isoformat() for d in event.iter_days()],
        'columns': [serialize_column(c) for c in columns],
        'roombooking_enabled': config.ENABLE_ROOMBOOKING,
        'rooms': ([{'id': r.id, 'full_name': r.full_name} for r in Room.query.filter_by(is_deleted=False)]
                 if config.ENABLE_ROOMBOOKING else []),
        'scheduled_contributions': [serialize_contribution(c, user) for c in scheduled],
        'unscheduled_contributions': [serialize_contribution(c, user) for c in unscheduled],
        'slot_minutes': settings['slot_minutes'],
        'day_start_time': settings['day_start_time'],
        'day_end_time': settings['day_end_time'],
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
    })
    def _process_POST(self, room_id, label):
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
        column = BlockScheduleColumn(event=self.event, room=room, label=label,
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
    })
    def _process_PATCH(self, label, position):
        if label is not None:
            label = label.strip()
            if not label:
                raise BadRequest('label cannot be empty')
            self.column.label = label
        if position is not None:
            self.column.position = position
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
        naive = datetime.combine(day, time(hour=start_minutes // 60, minute=start_minutes % 60))
        start_dt = self.event.tzinfo.localize(naive).astimezone(UTC)
        assignment = BlockScheduleAssignment.query.filter_by(contribution_id=contribution.id).first()
        if assignment is None:
            assignment = BlockScheduleAssignment(contribution=contribution)
            db.session.add(assignment)
        assignment.column = column
        with track_location_changes(), track_time_changes():
            contribution.location_data = {
                'inheriting': False,
                'room': None,
                'venue': None,
                'room_name': column.title,
                'venue_name': '',
                'address': contribution.address,
            }
            db.session.flush()
            if contribution.timetable_entry is None:
                schedule_contribution(contribution, start_dt)
            else:
                update_timetable_entry(contribution.timetable_entry, {'start_dt': start_dt})
            db.session.flush()
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


class RHDisplayBlockSchedule(RHDisplayEventBase):
    def _process(self):
        return WPDisplayBlockSchedule.render_template('display.html', self.event)


class RHDisplayGridData(RHDisplayEventBase):
    def _process(self):
        day = _event_day(self.event, request.args.get('day'))
        return jsonify(_grid_payload(self.event, day, session.user))
