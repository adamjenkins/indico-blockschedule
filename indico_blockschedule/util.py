# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from indico.web.flask.util import url_for


def serialize_column(column):
    return {
        'id': column.id,
        'room_id': column.room_id,
        'position': column.position,
        'label': column.label,
        'title': column.title,
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
