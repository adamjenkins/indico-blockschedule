# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

import re
from datetime import UTC, datetime, time, timedelta

from flask import jsonify, request, session
from sqlalchemy.orm import selectinload
from webargs import fields
from webargs.flaskparser import use_kwargs
from werkzeug.exceptions import BadRequest

from indico.core.config import config
from indico.core.db import db
from indico.modules.events.contributions.models.contributions import Contribution
from indico.modules.events.controllers.base import RHDisplayEventBase
from indico.modules.events.management.controllers.base import RHManageEventBase
from indico.modules.events.sessions.models.sessions import Session
from indico.modules.events.timetable.models.entries import TimetableEntryType
from indico.modules.events.timetable.operations import create_break_entry, delete_timetable_entry, update_break_entry
from indico.modules.events.util import track_time_changes
from indico.modules.rb.models.rooms import Room
from indico.util.spreadsheets import send_csv

from indico_blockschedule.models.columns import BlockScheduleColumn
from indico_blockschedule.models.groups import BlockScheduleGroup
from indico_blockschedule.models.session_blocks import BlockScheduleSessionBlock
from indico_blockschedule.util import (ScheduleOverlapError, assign_contribution_to_column, autoschedule,
                                       build_export_rows, build_export_sheets, clear_schedule, event_contributions,
                                       get_session_blocks, get_spanning_blocks, get_unscheduled_contributions, send_ods,
                                       send_xlsx_multisheet, serialize_column, serialize_contribution, serialize_group,
                                       serialize_session_block, serialize_spanning_block)
from indico_blockschedule.views import WPDisplayBlockSchedule, WPManageBlockSchedule, WPManageTrackColors


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


def _minutes_to_hhmm(minutes):
    minutes = max(0, min(minutes, 24 * 60))
    return f'{minutes // 60:02d}:{minutes % 60:02d}'


def _day_bounds(scheduled, spanning_blocks, slot_minutes, settings):
    """The display grid's time range: from the first item's start to the last item's end,
    rounded out to whole slots, for the busy day shown — falling back to the configured
    default range (used unconditionally for the management grid) when nothing is scheduled.
    """
    starts = [c['start_minutes'] for c in scheduled if c['start_minutes'] is not None]
    ends = [c['start_minutes'] + (c['duration_minutes'] or 0) for c in scheduled if c['start_minutes'] is not None]
    starts += [b['start_minutes'] for b in spanning_blocks]
    ends += [b['start_minutes'] + b['duration_minutes'] for b in spanning_blocks]
    if not starts:
        return settings['day_start_time'], settings['day_end_time']
    start = (min(starts) // slot_minutes) * slot_minutes
    end = -(-max(ends) // slot_minutes) * slot_minutes  # round up
    return _minutes_to_hhmm(start), _minutes_to_hhmm(end)


def _grid_payload(event, day, user=None, *, full_day=False, accessible_only=False):
    from indico_blockschedule.plugin import BlockschedulePlugin
    columns = (BlockScheduleColumn.query
              .with_parent(event)
              .order_by(BlockScheduleColumn.position)
              .all())
    groups = (BlockScheduleGroup.query
             .filter_by(event_id=event.id)
             # `serialize_group` reads each group's columns; without this that is
             # one query per group on top of everything else.
             .options(selectinload('columns'))
             .order_by(BlockScheduleGroup.position)
             .all())
    # One preloaded query for the whole set, then split it in Python: the day
    # filter needs each entry's start in the event's timezone, which is not a
    # comparison the database can make without knowing the zone.
    contributions = event_contributions(event, accessible_only=accessible_only)
    scheduled = [c for c in contributions
                if c.timetable_entry is not None
                and c.timetable_entry.start_dt.astimezone(event.tzinfo).date() == day]
    unscheduled = get_unscheduled_contributions(event, contributions)
    settings = BlockschedulePlugin.event_settings.get_all(event)
    track_colors = settings['track_colors'] or {}
    spanning_blocks = get_spanning_blocks(event, day)
    session_blocks = get_session_blocks(event, day)
    description_display = settings['description_display']
    serialized_scheduled = [serialize_contribution(c, user, description_display) for c in scheduled]
    serialized_spanning_blocks = [serialize_spanning_block(e) for e in spanning_blocks]
    if full_day:
        day_start_time, day_end_time = '00:00', '24:00'
    else:
        day_start_time, day_end_time = _day_bounds(serialized_scheduled, serialized_spanning_blocks,
                                                    settings['slot_minutes'], settings)
    return {
        'day': day.isoformat(),
        'event_days': [d.isoformat() for d in event.iter_days()],
        'event_title': event.title,
        # The event's own logo, from the Layout page. Core already serves it at a
        # URL containing the image's hash, so a replaced logo is a different URL
        # and nothing downstream can cache the old one -- which is what makes it
        # safe for the phone app to keep a copy indefinitely. None when unset,
        # rather than an empty string, so "no logo" cannot be mistaken for a
        # broken one.
        'event_logo_url': event.logo_url if event.has_logo else None,
        'columns': [serialize_column(c) for c in columns],
        'groups': [serialize_group(g) for g in groups],
        'roombooking_enabled': config.ENABLE_ROOMBOOKING,
        'rooms': ([{'id': r.id, 'full_name': r.full_name} for r in Room.query.filter_by(is_deleted=False)]
                 if config.ENABLE_ROOMBOOKING else []),
        'sessions': [{'id': s.id, 'title': s.title, 'color': s.colors.background if s.colors else None}
                    for s in event.sessions if not s.is_deleted],
        'tracks': [{'id': t.id, 'title': t.title, 'color': track_colors.get(str(t.id))} for t in event.tracks],
        'scheduled_contributions': serialized_scheduled,
        'unscheduled_contributions': [serialize_contribution(c, user, description_display) for c in unscheduled],
        'spanning_blocks': serialized_spanning_blocks,
        'session_blocks': [serialize_session_block(b) for b in session_blocks],
        'slot_minutes': settings['slot_minutes'],
        'day_start_time': day_start_time,
        'day_end_time': day_end_time,
        'working_hours_start': settings['day_start_time'],
        'working_hours_end': settings['day_end_time'],
        'gap_minutes': settings['gap_minutes'],
        'snap_minutes': settings['snap_minutes'],
        'row_height_px': settings['row_height_px'],
        'show_session_track': settings['show_session_track'],
        'description_display': description_display,
        'title_max_lines': settings['title_max_lines'],
    }


class RHBlockScheduleManageBase(RHManageEventBase):
    pass


class RHManageBlockSchedule(RHBlockScheduleManageBase):
    def _process(self):
        return WPManageBlockSchedule.render_template('manage.html', self.event)


class RHManageTrackColors(RHBlockScheduleManageBase):
    """The page where a manager assigns a colour to each of the event's tracks."""

    def _process(self):
        from indico_blockschedule.plugin import BlockschedulePlugin
        colors = BlockschedulePlugin.event_settings.get(self.event, 'track_colors') or {}
        tracks = [{'id': t.id, 'title': t.title, 'color': colors.get(str(t.id))} for t in self.event.tracks]
        # Handed to the page as an attribute rather than fetched: the only endpoint that
        # already knows about tracks is grid-data, and pulling an entire day's schedule to
        # populate a list of ten swatches would be a strange way to spend a request.
        return WPManageTrackColors.render_template('track_colors.html', self.event, tracks=tracks)


class RHTrackColorsUpdate(RHBlockScheduleManageBase):
    @use_kwargs({
        # A mapping of track id (as a string, since JSON object keys always are) to 'rrggbb',
        # or to null to drop back to the default badge colour. Sent whole rather than one
        # track at a time: the page saves the lot, and a partial write would be a way to end
        # up with stored colours that do not match what is on screen.
        'colors': fields.Dict(keys=fields.Str(), values=fields.Str(allow_none=True), required=True),
    })
    def _process_PATCH(self, colors):
        from indico_blockschedule.plugin import BlockschedulePlugin
        known = {str(t.id) for t in self.event.tracks}
        stored = {}
        for track_id, color in colors.items():
            if track_id not in known:
                raise BadRequest(f'unknown track: {track_id}')
            if not color:
                continue
            color = color.lstrip('#')
            if not _HEX_COLOR_RE.match(color):
                raise BadRequest(f'invalid colour for track {track_id}: {color}')
            stored[track_id] = color.lower()
        BlockschedulePlugin.event_settings.set(self.event, 'track_colors', stored)
        return jsonify(track_colors=stored)


class RHManageGridData(RHBlockScheduleManageBase):
    def _process(self):
        day = _event_day(self.event, request.args.get('day'))
        return jsonify(_grid_payload(self.event, day, session.user, full_day=True))


class RHColumnCreate(RHBlockScheduleManageBase):
    @use_kwargs({
        'room_id': fields.Int(load_default=None),
        'label': fields.Str(load_default=None),
        'color': fields.Str(load_default=None),
        'min_width_px': fields.Int(load_default=None),
    })
    def _process_POST(self, room_id, label, color, min_width_px):
        room = None
        if room_id is not None:
            room = Room.query.filter_by(id=room_id, is_deleted=False).first_or_404()
        label = (label or '').strip()
        if not label:
            if room is None:
                raise BadRequest('label is required when no room is selected')
            label = room.full_name
        if min_width_px is not None and min_width_px < 0:
            raise BadRequest('min_width_px cannot be negative')
        max_position = (db.session.query(db.func.max(BlockScheduleColumn.position))
                        .filter(BlockScheduleColumn.event_id == self.event.id)
                        .scalar())
        column = BlockScheduleColumn(event=self.event, room=room, label=label, color=_validate_color(color),
                                     min_width_px=min_width_px, position=(max_position or 0) + 1)
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
        'min_width_px': fields.Int(load_default=None),
    })
    def _process_PATCH(self, label, position, color, min_width_px):
        if label is not None:
            label = label.strip()
            if not label:
                raise BadRequest('label cannot be empty')
            self.column.label = label
        if position is not None:
            self.column.position = position
        if color is not None:
            self.column.color = _validate_color(color) if color else None
        if min_width_px is not None:
            if min_width_px < 0:
                raise BadRequest('min_width_px cannot be negative')
            # 0 means "no minimum" -- simpler than distinguishing "not provided" from
            # "explicitly cleared" through webargs' load_default.
            self.column.min_width_px = min_width_px or None
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


def _resolve_columns(event, column_ids):
    """Map ids to this event's columns, rejecting anything foreign.

    Group membership is set wholesale rather than incrementally, so an id
    belonging to another event would otherwise silently attach a column the
    caller cannot even see.
    """
    columns = BlockScheduleColumn.query.filter(BlockScheduleColumn.event_id == event.id,
                                               BlockScheduleColumn.id.in_(column_ids)).all()
    if len(columns) != len(set(column_ids)):
        raise BadRequest('column_ids must all belong to this event')
    return columns


class RHGroupCreate(RHBlockScheduleManageBase):
    @use_kwargs({
        'title': fields.Str(required=True),
        'column_ids': fields.List(fields.Int(), load_default=list),
    })
    def _process_POST(self, title, column_ids):
        title = title.strip()
        if not title:
            raise BadRequest('title is required')
        if BlockScheduleGroup.query.filter_by(event_id=self.event.id, title=title).has_rows():
            raise BadRequest('a group with that name already exists')
        max_position = (db.session.query(db.func.max(BlockScheduleGroup.position))
                        .filter(BlockScheduleGroup.event_id == self.event.id)
                        .scalar())
        group = BlockScheduleGroup(event=self.event, title=title, position=(max_position or 0) + 1)
        group.columns = set(_resolve_columns(self.event, column_ids))
        db.session.add(group)
        db.session.flush()
        return jsonify(serialize_group(group))


class RHGroupDeleteUpdate(RHBlockScheduleManageBase):
    def _process_args(self):
        RHBlockScheduleManageBase._process_args(self)
        self.group = (BlockScheduleGroup.query
                      .filter_by(id=request.view_args['group_id'], event_id=self.event.id)
                      .first_or_404())

    @use_kwargs({
        'title': fields.Str(load_default=None),
        'column_ids': fields.List(fields.Int(), load_default=None),
    })
    def _process_PATCH(self, title, column_ids):
        if title is not None:
            title = title.strip()
            if not title:
                raise BadRequest('title cannot be empty')
            clash = (BlockScheduleGroup.query
                     .filter(BlockScheduleGroup.event_id == self.event.id,
                             BlockScheduleGroup.title == title,
                             BlockScheduleGroup.id != self.group.id)
                     .has_rows())
            if clash:
                raise BadRequest('a group with that name already exists')
            self.group.title = title
        if column_ids is not None:
            self.group.columns = set(_resolve_columns(self.event, column_ids))
        db.session.flush()
        return jsonify(serialize_group(self.group))

    def _process_DELETE(self):
        db.session.delete(self.group)
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
        start_dt = _combine_local(self.event, day, start_minutes)
        try:
            assign_contribution_to_column(contribution, column, start_dt)
        except ScheduleOverlapError as exc:
            raise BadRequest(str(exc))
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


_DESCRIPTION_DISPLAY_CHOICES = ('hidden', 'full', 'truncated')
_MAX_TITLE_LINES = 20


class RHSettingsUpdate(RHBlockScheduleManageBase):
    @use_kwargs({
        'gap_minutes': fields.Int(load_default=None),
        'snap_minutes': fields.Int(load_default=None),
        'row_height_px': fields.Int(load_default=None),
        'show_session_track': fields.Bool(load_default=None),
        'description_display': fields.Str(load_default=None),
        'title_max_lines': fields.Int(load_default=None),
    })
    def _process_PATCH(self, gap_minutes, snap_minutes, row_height_px, show_session_track, description_display,
                       title_max_lines):
        from indico_blockschedule.plugin import BlockschedulePlugin
        settings = BlockschedulePlugin.event_settings
        if gap_minutes is not None:
            if gap_minutes < 0:
                raise BadRequest('gap_minutes cannot be negative')
            settings.set(self.event, 'gap_minutes', gap_minutes)
        if snap_minutes is not None:
            if snap_minutes < 0:
                raise BadRequest('snap_minutes cannot be negative')
            settings.set(self.event, 'snap_minutes', snap_minutes)
        if row_height_px is not None:
            if row_height_px < 20:
                raise BadRequest('row_height_px is too small')
            settings.set(self.event, 'row_height_px', row_height_px)
        if show_session_track is not None:
            settings.set(self.event, 'show_session_track', show_session_track)
        if description_display is not None:
            if description_display not in _DESCRIPTION_DISPLAY_CHOICES:
                raise BadRequest(f'description_display must be one of {_DESCRIPTION_DISPLAY_CHOICES}')
            settings.set(self.event, 'description_display', description_display)
        if title_max_lines is not None:
            # 0 means "no clamp at all"; anything higher is a line count. The upper bound is
            # arbitrary but keeps a typo like 300 from producing a block taller than the day.
            if not 0 <= title_max_lines <= _MAX_TITLE_LINES:
                raise BadRequest(f'title_max_lines must be between 0 and {_MAX_TITLE_LINES}')
            settings.set(self.event, 'title_max_lines', title_max_lines)
        return jsonify(settings.get_all(self.event))


class RHAutoSchedule(RHBlockScheduleManageBase):
    @use_kwargs({
        'start_day': fields.Str(required=True),
        'start_minutes': fields.Int(required=True),
        'end_day': fields.Str(required=True),
        'end_minutes': fields.Int(required=True),
        'clear': fields.Bool(load_default=False),
        'exclude_session_ids': fields.List(fields.Int(), load_default=()),
        'exclude_track_ids': fields.List(fields.Int(), load_default=()),
    })
    def _process_POST(self, start_day, start_minutes, end_day, end_minutes, clear,
                      exclude_session_ids, exclude_track_ids):
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
        exclude_session_ids = set(exclude_session_ids)
        exclude_track_ids = set(exclude_track_ids)
        if clear:
            # "Clear schedule" is just that -- it doesn't also run the autoscheduler
            # afterwards. Run it again unchecked if you want to reschedule.
            clear_schedule(self.event, columns, start_dt, end_dt,
                          exclude_session_ids=exclude_session_ids, exclude_track_ids=exclude_track_ids)
            return jsonify(cleared=True, unscheduled_count=0, unscheduled_titles=[])
        gap_minutes = BlockschedulePlugin.event_settings.get(self.event, 'gap_minutes')
        leftover = autoschedule(self.event, columns, start_dt, end_dt, gap_minutes,
                               exclude_session_ids=exclude_session_ids, exclude_track_ids=exclude_track_ids)
        return jsonify(cleared=False, unscheduled_count=len(leftover),
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


class RHSessionBlockCreate(RHBlockScheduleManageBase):
    @use_kwargs({
        'session_id': fields.Int(load_default=None),
        'title': fields.Str(load_default=None),
        'day': fields.Str(required=True),
        'start_minutes': fields.Int(required=True),
        'duration_minutes': fields.Int(required=True),
        'color': fields.Str(load_default=None),
        'column_ids': fields.List(fields.Int(), load_default=None),
    })
    def _process_POST(self, session_id, title, day, start_minutes, duration_minutes, color, column_ids):
        session_ = None
        if session_id is not None:
            session_ = Session.query.filter_by(id=session_id, event_id=self.event.id, is_deleted=False).first_or_404()
        title = (title or '').strip() or None
        if not title and session_ is None:
            raise BadRequest('title is required when no session is selected')
        if duration_minutes <= 0:
            raise BadRequest('duration_minutes must be positive')
        if column_ids:
            valid_ids = {c.id for c in BlockScheduleColumn.query.filter_by(event_id=self.event.id)}
            if not set(column_ids) <= valid_ids:
                raise BadRequest('column_ids must reference columns of this event')
        start_dt = _combine_local(self.event, _event_day(self.event, day), start_minutes)
        block = BlockScheduleSessionBlock(
            event=self.event, session=session_, title=title, color=_validate_color(color),
            start_dt=start_dt, duration=timedelta(minutes=duration_minutes), column_ids=column_ids or None)
        db.session.add(block)
        db.session.flush()
        return jsonify(serialize_session_block(block))


class RHSessionBlockDeleteUpdate(RHBlockScheduleManageBase):
    def _process_args(self):
        RHBlockScheduleManageBase._process_args(self)
        self.block = (BlockScheduleSessionBlock.query
                     .filter_by(id=request.view_args['block_id'], event_id=self.event.id)
                     .first_or_404())

    @use_kwargs({
        'session_id': fields.Int(load_default=None, allow_none=True),
        'title': fields.Str(load_default=None),
        'day': fields.Str(load_default=None),
        'start_minutes': fields.Int(load_default=None),
        'duration_minutes': fields.Int(load_default=None),
        'color': fields.Str(load_default=None, allow_none=True),
        'column_ids': fields.List(fields.Int(), load_default=None, allow_none=True),
    })
    def _process_PATCH(self, session_id, title, day, start_minutes, duration_minutes, color, column_ids):
        if session_id is not None:
            self.block.session = (Session.query.filter_by(id=session_id, event_id=self.event.id, is_deleted=False)
                                  .first_or_404()) if session_id else None
        if title is not None:
            self.block.title = title.strip() or None
        if day is not None and start_minutes is not None:
            self.block.start_dt = _combine_local(self.event, _event_day(self.event, day), start_minutes)
        if duration_minutes is not None:
            if duration_minutes <= 0:
                raise BadRequest('duration_minutes must be positive')
            self.block.duration = timedelta(minutes=duration_minutes)
        if color is not None:
            self.block.color = _validate_color(color) if color else None
        if column_ids is not None:
            if column_ids:
                valid_ids = {c.id for c in BlockScheduleColumn.query.filter_by(event_id=self.event.id)}
                if not set(column_ids) <= valid_ids:
                    raise BadRequest('column_ids must reference columns of this event')
            self.block.column_ids = column_ids or None
        db.session.flush()
        return jsonify(serialize_session_block(self.block))

    def _process_DELETE(self):
        db.session.delete(self.block)
        db.session.flush()
        return jsonify(success=True)


_EXPORT_FORMATS = ('csv', 'xlsx', 'ods')


def _export_response(event, fmt, *, accessible_only=False):
    if fmt not in _EXPORT_FORMATS:
        raise BadRequest(f'format must be one of {_EXPORT_FORMATS}')
    day = _event_day(event, request.args.get('day'))
    if fmt == 'csv':
        # CSV has no concept of multiple sheets, so it only ever gets the flat contribution
        # list -- the second, grid-shaped sheet is xlsx/ods only.
        headers, rows = build_export_rows(event, day, accessible_only=accessible_only)
        return send_csv('block-schedule.csv', headers, rows)
    sheets = build_export_sheets(event, day, accessible_only=accessible_only)
    if fmt == 'xlsx':
        return send_xlsx_multisheet('block-schedule.xlsx', sheets)
    return send_ods('block-schedule.ods', sheets)


class RHDisplayBlockSchedule(RHDisplayEventBase):
    def _process(self):
        return WPDisplayBlockSchedule.render_template('display.html', self.event)


class RHDisplayGridData(RHDisplayEventBase):
    def _process(self):
        day = _event_day(self.event, request.args.get('day'))
        # `accessible_only`: the event being public does not make every
        # contribution in it public, and this payload is cached to phones.
        return jsonify(_grid_payload(self.event, day, session.user, accessible_only=True))


class RHDisplayExport(RHDisplayEventBase):
    def _process(self):
        # A spreadsheet is a copy that leaves the site entirely, so the same
        # filter matters here more than anywhere.
        return _export_response(self.event, request.view_args['fmt'], accessible_only=True)


class RHManageExport(RHBlockScheduleManageBase):
    def _process(self):
        return _export_response(self.event, request.view_args['fmt'])
