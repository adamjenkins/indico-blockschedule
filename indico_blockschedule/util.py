# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from collections import defaultdict
from datetime import timedelta

from indico.core.db import db
from indico.modules.events.timetable.operations import (create_session_block_entry, schedule_contribution,
                                                        update_timetable_entry)
from indico.modules.events.util import track_location_changes, track_time_changes
from indico.web.flask.util import url_for

from indico_blockschedule.models.assignments import BlockScheduleAssignment


def serialize_column(column):
    return {
        'id': column.id,
        'room_id': column.room_id,
        'position': column.position,
        'label': column.label,
        'title': column.title,
        'color': column.color,
    }


def _contribution_people(contribution):
    seen = set()
    names = []
    for person_link in contribution.speakers + contribution.primary_authors + contribution.secondary_authors:
        if person_link.person_id in seen:
            continue
        seen.add(person_link.person_id)
        names.append(person_link.full_name)
    return names


def serialize_contribution(contribution, user=None):
    entry = contribution.timetable_entry
    start_local = entry.start_dt.astimezone(contribution.event.tzinfo) if entry else None
    assignment = contribution.blockschedule_assignment
    return {
        'id': contribution.id,
        'title': contribution.title,
        'people': _contribution_people(contribution),
        'duration_minutes': int(contribution.duration.total_seconds() // 60) if contribution.duration else None,
        'column_id': assignment.column_id if entry and assignment else None,
        'start_minutes': start_local.hour * 60 + start_local.minute if start_local else None,
        'start_dt': entry.start_dt.isoformat() if entry else None,
        'url': url_for('contributions.display_contribution', contribution),
        'is_starred': bool(user and contribution in user.favorite_contributions),
    }


def get_unscheduled_contributions(event):
    return [c for c in event.contributions if not c.is_deleted and c.timetable_entry is None]


def serialize_spanning_block(entry):
    break_ = entry.break_
    start_local = entry.start_dt.astimezone(entry.event.tzinfo)
    return {
        'id': entry.id,
        'title': break_.title,
        'start_minutes': start_local.hour * 60 + start_local.minute,
        'duration_minutes': int(break_.duration.total_seconds() // 60),
        'color': break_.background_color or None,
    }


def get_spanning_blocks(event, day):
    from indico.modules.events.timetable.models.entries import TimetableEntryType

    return [entry for entry in event.timetable_entries
            if entry.parent_id is None and entry.type == TimetableEntryType.BREAK
            and entry.start_dt.astimezone(event.tzinfo).date() == day]


def assign_contribution_to_column(contribution, column, start_dt, session_block=None):
    """Schedule (or reschedule) `contribution` into `column` at `start_dt`.

    Shared between the manual drag-and-drop endpoint and the autoscheduler
    so both keep the blockschedule assignment, the contribution's room
    label, and the core `TimetableEntry` in lockstep.

    A contribution that belongs to a `Session` can only be scheduled as a
    child of a session-block timetable entry (a bare top-level entry isn't
    valid in core Indico for session contributions) — pass `session_block`
    to reuse one (e.g. for a whole session scheduled back-to-back by the
    autoscheduler); otherwise a fresh one sized to this contribution alone
    is created on first scheduling.
    """
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
        if contribution.timetable_entry is not None:
            update_timetable_entry(contribution.timetable_entry, {'start_dt': start_dt})
        elif session_block is not None:
            schedule_contribution(contribution, start_dt, session_block=session_block)
        elif contribution.session_id is not None:
            block_entry = create_session_block_entry(contribution.session,
                                                      {'start_dt': start_dt, 'duration': contribution.duration})
            schedule_contribution(contribution, start_dt, session_block=block_entry.session_block)
        else:
            schedule_contribution(contribution, start_dt)
        db.session.flush()


def _group_key(contribution):
    if contribution.session_id is not None:
        return ('session', contribution.session_id)
    if contribution.track_id is not None:
        return ('track', contribution.track_id)
    return None


def autoschedule(event, columns, start_dt, end_dt, gap_minutes):
    """Automatically schedule unscheduled contributions within [start_dt, end_dt).

    Contributions sharing a session (first priority) or, failing that, a
    track (second priority) are packed as a contiguous run into whichever
    column has the earliest free slot able to fit the whole run, so a
    session/track is never split into parallel rooms. Contributions with
    neither are placed individually wherever there's room. Returns the
    list of contributions that couldn't be fit into the timespan.
    """
    gap = timedelta(minutes=gap_minutes)
    groups = defaultdict(list)
    standalone = []
    for contribution in get_unscheduled_contributions(event):
        key = _group_key(contribution)
        if key is None:
            standalone.append(contribution)
        else:
            groups[key].append(contribution)

    def run_duration(items):
        total = sum((c.duration for c in items), timedelta())
        return total + gap * (len(items) - 1)

    cursors = {column.id: start_dt for column in columns}

    def place_run(key, items):
        items = sorted(items, key=lambda c: c.id)
        duration = run_duration(items)
        candidates = sorted(columns, key=lambda col: cursors[col.id])
        for column in candidates:
            cursor = cursors[column.id]
            if cursor + duration <= end_dt:
                # A session's contributions must share a single session-block parent entry
                # (core Indico has no concept of a bare top-level session contribution) so the
                # whole run is created as one block up front, sized to fit every item + gaps.
                session_block = (create_session_block_entry(items[0].session, {
                    'start_dt': cursor, 'duration': duration,
                }).session_block if key[0] == 'session' else None)
                for contribution in items:
                    assign_contribution_to_column(contribution, column, cursor, session_block=session_block)
                    cursor += contribution.duration + gap
                cursors[column.id] = cursor
                return True
        return False

    leftover = []
    for key, items in sorted(groups.items(), key=lambda kv: run_duration(kv[1]), reverse=True):
        if not place_run(key, items):
            standalone.extend(items)

    for contribution in standalone:
        candidates = sorted(columns, key=lambda col: cursors[col.id])
        placed = False
        for column in candidates:
            cursor = cursors[column.id]
            if cursor + contribution.duration <= end_dt:
                assign_contribution_to_column(contribution, column, cursor)
                cursors[column.id] = cursor + contribution.duration + gap
                placed = True
                break
        if not placed:
            leftover.append(contribution)

    return leftover
