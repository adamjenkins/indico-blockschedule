# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

import random
from collections import defaultdict
from datetime import timedelta
from io import BytesIO
from operator import itemgetter

from indico.core.db import db
from indico.modules.events.timetable.operations import (delete_timetable_entry, schedule_contribution,
                                                        update_timetable_entry)
from indico.modules.events.util import track_location_changes, track_time_changes
from indico.util.string import strip_tags, truncate
from indico.web.flask.util import send_file, url_for

from indico_blockschedule.models.assignments import BlockScheduleAssignment


def serialize_column(column):
    return {
        'id': column.id,
        'room_id': column.room_id,
        'position': column.position,
        'label': column.label,
        'title': column.title,
        'color': column.color,
        'min_width_px': column.min_width_px,
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


def _description_preview(contribution, mode):
    if mode == 'hidden' or not contribution.description:
        return None
    text = strip_tags(str(contribution.description)).strip()
    if not text:
        return None
    if mode == 'truncated':
        return truncate(text, 200)
    return text


def serialize_contribution(contribution, user=None, description_display='hidden'):
    entry = contribution.timetable_entry
    start_local = entry.start_dt.astimezone(contribution.event.tzinfo) if entry else None
    assignment = contribution.blockschedule_assignment
    session_ = (assignment.session if assignment and assignment.session_id else contribution.session)
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
        'session_name': session_.title if session_ else None,
        'track_name': contribution.track.title if contribution.track else None,
        'description': _description_preview(contribution, description_display),
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


def serialize_session_block(block):
    start_local = block.start_dt.astimezone(block.event.tzinfo)
    session_ = block.session
    return {
        'id': block.id,
        'session_id': block.session_id,
        'title': block.title or (session_.title if session_ else None),
        'start_minutes': start_local.hour * 60 + start_local.minute,
        'duration_minutes': int(block.duration.total_seconds() // 60),
        'color': block.color or (session_.colors.background if session_ and session_.colors else None),
        'column_ids': block.column_ids,
    }


def get_session_blocks(event, day):
    from indico_blockschedule.models.session_blocks import BlockScheduleSessionBlock

    return [b for b in (BlockScheduleSessionBlock.query
                       .with_parent(event)
                       .all())
            if b.start_dt.astimezone(event.tzinfo).date() == day]


def get_spanning_blocks(event, day):
    from indico.modules.events.timetable.models.entries import TimetableEntryType

    return [entry for entry in event.timetable_entries
            if entry.parent_id is None and entry.type == TimetableEntryType.BREAK
            and entry.start_dt.astimezone(event.tzinfo).date() == day]


class ScheduleOverlapError(Exception):
    """Raised when scheduling a contribution would overlap another one already in the same column."""


def _column_overlap_exists(column, start_dt, end_dt, exclude_contribution_id=None):
    """Whether any *other* contribution already in `column` overlaps `[start_dt, end_dt)`."""
    for assignment in column.assignments:
        if assignment.contribution_id == exclude_contribution_id:
            continue
        entry = assignment.contribution.timetable_entry
        if entry is None:
            continue
        if entry.start_dt < end_dt and start_dt < entry.end_dt:
            return True
    return False


def assign_contribution_to_column(contribution, column, start_dt):
    """Schedule (or reschedule) `contribution` into `column` at `start_dt`.

    Shared between the manual drag-and-drop endpoint and the autoscheduler
    so both keep the blockschedule assignment, the contribution's room
    label, and the core `TimetableEntry` in lockstep.

    Block Schedule never creates session-block timetable entries: core
    Indico only allows a session's contributions to be scheduled as
    children of one, so a contribution's `session` is snapshotted onto
    the assignment (for display/grouping) and then cleared right before
    scheduling, letting it land as a plain top-level entry like everything
    else here. `track` needs no such handling — it has no equivalent
    scheduling-time constraint, so it's read live from the contribution.

    Raises `ScheduleOverlapError` if this would overlap another
    contribution already in `column` — two contributions are never allowed
    to share a room at an overlapping time, regardless of how they got
    there (manual drag, or the autoscheduler).
    """
    end_dt = start_dt + contribution.duration
    if _column_overlap_exists(column, start_dt, end_dt, exclude_contribution_id=contribution.id):
        raise ScheduleOverlapError(
            f'"{contribution.title}" would overlap another contribution already in "{column.title}"')
    assignment = BlockScheduleAssignment.query.filter_by(contribution_id=contribution.id).first()
    if assignment is None:
        assignment = BlockScheduleAssignment(contribution=contribution)
        db.session.add(assignment)
    assignment.column = column
    if contribution.session_id is not None:
        assignment.session_id = contribution.session_id
    with track_location_changes(), track_time_changes():
        contribution.location_data = {
            'inheriting': False,
            'room': None,
            'venue': None,
            'room_name': column.title,
            'venue_name': '',
            'address': contribution.address,
        }
        if contribution.session_id is not None:
            contribution.session = None
        db.session.flush()
        if contribution.timetable_entry is not None:
            update_timetable_entry(contribution.timetable_entry, {'start_dt': start_dt})
        else:
            schedule_contribution(contribution, start_dt)
        db.session.flush()


def clear_schedule(event, columns, start_dt, end_dt, *, exclude_session_ids=None, exclude_track_ids=None):
    """Unschedule every contribution placed in `columns` whose start falls within
    [start_dt, end_dt) -- except ones belonging to an excluded session or track, which are
    left exactly where they are. Session membership is read from the assignment's snapshot
    (`assignment.session_id`), since a contribution's own `session` is cleared once scheduled
    (see `assign_contribution_to_column`); track has no such snapshot, so it's read live.
    """
    exclude_session_ids = exclude_session_ids or set()
    exclude_track_ids = exclude_track_ids or set()
    column_ids = {column.id for column in columns}
    assignments = (BlockScheduleAssignment.query
                  .join(BlockScheduleAssignment.contribution)
                  .filter(BlockScheduleAssignment.column_id.in_(column_ids)))
    for assignment in assignments:
        contribution = assignment.contribution
        entry = contribution.timetable_entry
        if entry is None or not (start_dt <= entry.start_dt < end_dt):
            continue
        if assignment.session_id is not None and assignment.session_id in exclude_session_ids:
            continue
        if contribution.track_id is not None and contribution.track_id in exclude_track_ids:
            continue
        delete_timetable_entry(entry)
        db.session.delete(assignment)
    db.session.flush()


def _group_key(contribution):
    if contribution.session_id is not None:
        return ('session', contribution.session_id)
    if contribution.track_id is not None:
        return ('track', contribution.track_id)
    return None


def _occupied_intervals(column, start_dt, end_dt):
    """Sorted `(start, end)` intervals already booked in `column` that overlap `[start_dt, end_dt)`."""
    intervals = []
    for assignment in column.assignments:
        entry = assignment.contribution.timetable_entry
        if entry is None or entry.end_dt <= start_dt or entry.start_dt >= end_dt:
            continue
        intervals.append((entry.start_dt, entry.end_dt))
    return sorted(intervals)


def _earliest_free_start(occupied, candidate_start, duration, gap, end_dt):
    """Earliest start >= `candidate_start` such that `[start, start + duration)` doesn't
    overlap any interval in `occupied`, or `None` if it doesn't fit before `end_dt`.
    """
    candidate_end = candidate_start + duration
    changed = True
    while changed:
        changed = False
        for occupied_start, occupied_end in occupied:
            if candidate_start < occupied_end and occupied_start < candidate_end:
                candidate_start = occupied_end + gap
                candidate_end = candidate_start + duration
                changed = True
        if candidate_end > end_dt:
            return None
    return candidate_start


def autoschedule(event, columns, start_dt, end_dt, gap_minutes, *, exclude_session_ids=None, exclude_track_ids=None):
    """Automatically schedule unscheduled contributions within [start_dt, end_dt).

    Contributions sharing a session or, failing that, a track are packed
    as a contiguous run into whichever column has the earliest free slot
    able to fit the whole run, so a session/track is never split into
    parallel rooms. Contributions with neither are placed individually
    wherever there's room. Which run/contribution gets first pick of the
    free slots is randomized on every call (the grouping and "never split
    a session/track across rooms" guarantees are unaffected — only the
    *order* contributions are offered to the placement loop is random).
    Never overlaps a contribution already sitting in a column — including
    ones placed there manually, outside of this run — by tracking each
    column's actual booked intervals and skipping past them rather than
    assuming every column is empty from `start_dt` onwards.
    Contributions belonging to a session/track in `exclude_session_ids`/
    `exclude_track_ids` are left untouched (not placed, not counted as
    leftover either -- they're simply not offered to the scheduler at all).
    Returns the list of contributions that couldn't be fit into the
    timespan.
    """
    exclude_session_ids = exclude_session_ids or set()
    exclude_track_ids = exclude_track_ids or set()
    gap = timedelta(minutes=gap_minutes)
    groups = defaultdict(list)
    standalone = []
    for contribution in get_unscheduled_contributions(event):
        if contribution.session_id is not None and contribution.session_id in exclude_session_ids:
            continue
        if contribution.track_id is not None and contribution.track_id in exclude_track_ids:
            continue
        key = _group_key(contribution)
        if key is None:
            standalone.append(contribution)
        else:
            groups[key].append(contribution)

    def run_duration(items):
        total = sum((c.duration for c in items), timedelta())
        return total + gap * (len(items) - 1)

    cursors = {column.id: start_dt for column in columns}
    occupied = {column.id: _occupied_intervals(column, start_dt, end_dt) for column in columns}

    def place_run(items):
        items = list(items)
        random.shuffle(items)
        duration = run_duration(items)
        candidates = sorted(columns, key=lambda col: cursors[col.id])
        for column in candidates:
            free_start = _earliest_free_start(occupied[column.id], cursors[column.id], duration, gap, end_dt)
            if free_start is None:
                continue
            cursor = free_start
            for contribution in items:
                assign_contribution_to_column(contribution, column, cursor)
                item_end = cursor + contribution.duration
                occupied[column.id].append((cursor, item_end))
                cursor = item_end + gap
            cursors[column.id] = cursor
            return True
        return False

    leftover = []
    grouped_runs = list(groups.values())
    random.shuffle(grouped_runs)
    for items in grouped_runs:
        if not place_run(items):
            standalone.extend(items)

    random.shuffle(standalone)
    for contribution in standalone:
        candidates = sorted(columns, key=lambda col: cursors[col.id])
        placed = False
        for column in candidates:
            free_start = _earliest_free_start(
                occupied[column.id], cursors[column.id], contribution.duration, gap, end_dt)
            if free_start is not None:
                assign_contribution_to_column(contribution, column, free_start)
                item_end = free_start + contribution.duration
                occupied[column.id].append((free_start, item_end))
                cursors[column.id] = item_end + gap
                placed = True
                break
        if not placed:
            leftover.append(contribution)

    return leftover


_EXPORT_HEADERS = ('Column', 'Start', 'End', 'Duration (min)', 'Title', 'Speakers', 'Session', 'Track')


def build_export_rows(event, day):
    """Headers + row dicts (one per scheduled contribution on `day`) for spreadsheet export."""
    scheduled = [c for c in event.contributions
                if not c.is_deleted and c.timetable_entry is not None
                and c.timetable_entry.start_dt.astimezone(event.tzinfo).date() == day]

    def sort_key(contribution):
        assignment = contribution.blockschedule_assignment
        position = assignment.column.position if assignment else 0
        return (position, contribution.timetable_entry.start_dt)

    rows = []
    for contribution in sorted(scheduled, key=sort_key):
        entry = contribution.timetable_entry
        start_local = entry.start_dt.astimezone(event.tzinfo)
        end_local = entry.end_dt.astimezone(event.tzinfo)
        assignment = contribution.blockschedule_assignment
        session_ = (assignment.session if assignment and assignment.session_id else contribution.session)
        rows.append({
            'Column': assignment.column.title if assignment else '',
            'Start': start_local.strftime('%Y-%m-%d %H:%M'),
            'End': end_local.strftime('%Y-%m-%d %H:%M'),
            'Duration (min)': int(contribution.duration.total_seconds() // 60) if contribution.duration else '',
            'Title': contribution.title,
            'Speakers': '; '.join(_contribution_people(contribution)),
            'Session': session_.title if session_ else '',
            'Track': contribution.track.title if contribution.track else '',
        })
    return list(_EXPORT_HEADERS), rows


def _minutes_to_hhmm(minutes):
    return f'{minutes // 60:02d}:{minutes % 60:02d}'


def parse_hhmm(value):
    hours, minutes = value.split(':')
    return int(hours) * 60 + int(minutes)


def build_grid_export_sheet(event, day):
    """A second sheet mirroring the visual block schedule grid: one column per room, and one
    merged, multi-line cell per scheduled presentation -- spanning the rows its duration
    covers, the way it visually spans rows on screen -- carrying room, session, track, author
    and date/time information, not just its title.

    Row boundaries are derived from the *actual* start/end times of the day's presentations
    (plus the event's configured working-hours bounds), not from a fixed slot size: snapping
    a contribution to a few minutes' precision while still rendering the visual grid in
    coarser slots (see `gridTime.ts`) means two presentations can legitimately start a few
    minutes apart within what would be the same coarse slot -- quantizing both into that one
    slot would make their merged ranges overlap, which both xlsxwriter and ODF reject outright.
    Using the exact set of boundary times in play guarantees every placement's row range lines
    up exactly with its neighbours, with no possible overlap.

    Returns `(time_labels, column_titles, placements)` where each placement is
    `{'row': <starting row index>, 'col': <column index>, 'row_span': <int>, 'text': <str>}`.
    """
    from indico_blockschedule.models.columns import BlockScheduleColumn
    from indico_blockschedule.plugin import BlockschedulePlugin

    settings = BlockschedulePlugin.event_settings.get_all(event)
    day_start = parse_hhmm(settings['day_start_time'])
    day_end = parse_hhmm(settings['day_end_time'])
    columns = (BlockScheduleColumn.query
              .with_parent(event)
              .order_by(BlockScheduleColumn.position)
              .all())
    column_index_by_id = {column.id: index for index, column in enumerate(columns)}

    scheduled = [c for c in event.contributions
                if not c.is_deleted and c.timetable_entry is not None
                and c.timetable_entry.start_dt.astimezone(event.tzinfo).date() == day]

    items = []
    boundaries = {day_start, day_end}
    for contribution in scheduled:
        assignment = contribution.blockschedule_assignment
        if not assignment:
            continue
        col = column_index_by_id.get(assignment.column_id)
        if col is None:
            continue
        entry = contribution.timetable_entry
        start_local = entry.start_dt.astimezone(event.tzinfo)
        end_local = entry.end_dt.astimezone(event.tzinfo)
        start_m = max(day_start, start_local.hour * 60 + start_local.minute)
        end_m = min(day_end, end_local.hour * 60 + end_local.minute)
        if end_m <= start_m:
            continue
        items.append((start_m, end_m, col, contribution, assignment, start_local, end_local))
        boundaries.update((start_m, end_m))

    sorted_boundaries = sorted(boundaries)
    row_of_minute = {minute: index for index, minute in enumerate(sorted_boundaries)}
    time_labels = [_minutes_to_hhmm(minute) for minute in sorted_boundaries[:-1]]

    placements = []
    for start_m, end_m, col, contribution, assignment, start_local, end_local in items:
        row = row_of_minute[start_m]
        row_span = row_of_minute[end_m] - row
        session_ = (assignment.session if assignment.session_id else contribution.session)
        speakers = '; '.join(_contribution_people(contribution))
        text = '\n'.join(filter(None, [
            contribution.title,
            f'Room: {assignment.column.title}',
            f'Session: {session_.title}' if session_ else None,
            f'Track: {contribution.track.title}' if contribution.track else None,
            f'Author(s): {speakers}' if speakers else None,
            f'Date: {start_local.strftime("%Y-%m-%d")}',
            f'Time: {start_local.strftime("%H:%M")}-{end_local.strftime("%H:%M")}',
        ]))
        placements.append({'row': row, 'col': col, 'row_span': row_span, 'text': text})

    # Defensive safety net: the app itself doesn't prevent two contributions from genuinely
    # overlapping in the same column (the grid would just show them stacked) -- an actually
    # overlapping pair would otherwise produce two overlapping merge ranges, which both
    # xlsxwriter and ODF reject outright. Push the later one down to start right after the
    # earlier one ends, shrinking (and, if there's no room left at all, dropping) it, rather
    # than letting the export blow up over data the UI itself doesn't forbid.
    num_rows = len(time_labels)
    by_column = defaultdict(list)
    for placement in placements:
        by_column[placement['col']].append(placement)
    resolved = []
    for column_placements in by_column.values():
        column_placements.sort(key=itemgetter('row'))
        next_free_row = 0
        for placement in column_placements:
            row = max(placement['row'], next_free_row)
            end_row = min(row + placement['row_span'], num_rows)
            if row >= end_row:
                continue
            resolved.append({**placement, 'row': row, 'row_span': end_row - row})
            next_free_row = end_row
    resolved.sort(key=itemgetter('col', 'row'))
    return time_labels, [column.title for column in columns], resolved


def build_export_sheets(event, day):
    """All sheets for the spreadsheet export: the flat contribution list, plus a second sheet
    laid out like the visual grid (see `build_grid_export_sheet`). CSV has no concept of
    multiple sheets, so it only ever uses `build_export_rows` directly -- these multi-sheet
    helpers are for xlsx/ods only.
    """
    list_headers, list_rows = build_export_rows(event, day)
    time_labels, column_titles, placements = build_grid_export_sheet(event, day)
    return [
        {'type': 'flat', 'name': 'Contributions', 'headers': list_headers, 'rows': list_rows},
        {'type': 'grid', 'name': 'Schedule Grid', 'time_labels': time_labels,
         'column_titles': column_titles, 'placements': placements},
    ]


def generate_xlsx_multisheet(sheets):
    """Like core's `generate_xlsx`, but writing several sheets to one workbook -- core's own
    helper only ever writes a single, flat one. Each entry of `sheets` is either a flat
    `{'type': 'flat', 'name', 'headers', 'rows'}` sheet (see `build_export_rows`) or a
    `{'type': 'grid', 'name', 'time_labels', 'column_titles', 'placements'}` one with
    merged, multi-line cells (see `build_grid_export_sheet`).
    """
    from xlsxwriter import Workbook

    buf = BytesIO()
    with Workbook(buf, {'in_memory': True}) as workbook:
        bold = workbook.add_format({'bold': True})
        wrapped = workbook.add_format({'text_wrap': True, 'valign': 'top'})
        for sheet in sheets:
            worksheet = workbook.add_worksheet(sheet['name'][:31])  # Excel's sheet-name length limit
            if sheet['type'] == 'flat':
                headers, rows = sheet['headers'], sheet['rows']
                header_positions = {header: i for i, header in enumerate(headers)}
                for col, header in enumerate(headers):
                    worksheet.write(0, col, header, bold)
                for row_index, row in enumerate(rows, 1):
                    for header, value in row.items():
                        worksheet.write(row_index, header_positions[header], value)
                continue
            worksheet.write(0, 0, 'Time', bold)
            for col, title in enumerate(sheet['column_titles'], start=1):
                worksheet.write(0, col, title, bold)
            for row, label in enumerate(sheet['time_labels'], start=1):
                worksheet.write(row, 0, label)
            for placement in sheet['placements']:
                first_row, col = placement['row'] + 1, placement['col'] + 1
                last_row = first_row + placement['row_span'] - 1
                if last_row > first_row:
                    worksheet.merge_range(first_row, col, last_row, col, placement['text'], wrapped)
                else:
                    worksheet.write(first_row, col, placement['text'], wrapped)
    buf.seek(0)
    return buf


def _ods_text_cell(text):
    from odf.table import TableCell
    from odf.text import P

    cell = TableCell(valuetype='string')
    for line in str(text).split('\n'):
        cell.addElement(P(text=line))
    return cell


def generate_ods(sheets):
    """Generate a multi-sheet ODS spreadsheet -- see `generate_xlsx_multisheet` for the shape
    of `sheets`. Row-spanning grid cells use `table:number-rows-spanned` plus a
    `CoveredTableCell` placeholder in each row it covers, ODF's equivalent of a merged range.
    """
    from odf.opendocument import OpenDocumentSpreadsheet
    from odf.table import CoveredTableCell, Table, TableCell, TableRow
    from odf.text import P

    doc = OpenDocumentSpreadsheet()
    for sheet in sheets:
        table = Table(name=sheet['name'])
        if sheet['type'] == 'flat':
            headers, rows = sheet['headers'], sheet['rows']
            header_row = TableRow()
            for header in headers:
                header_row.addElement(_ods_text_cell(header))
            table.addElement(header_row)
            for row in rows:
                table_row = TableRow()
                for header in headers:
                    table_row.addElement(_ods_text_cell(row.get(header, '')))
                table.addElement(table_row)
            doc.spreadsheet.addElement(table)
            continue

        time_labels, column_titles, placements = sheet['time_labels'], sheet['column_titles'], sheet['placements']
        grid = [[None] * len(column_titles) for _ in time_labels]
        for placement in placements:
            grid[placement['row']][placement['col']] = placement
            for covered_row in range(placement['row'] + 1, placement['row'] + placement['row_span']):
                if covered_row < len(time_labels):
                    grid[covered_row][placement['col']] = 'covered'

        header_row = TableRow()
        header_row.addElement(_ods_text_cell('Time'))
        for title in column_titles:
            header_row.addElement(_ods_text_cell(title))
        table.addElement(header_row)

        for row_index, label in enumerate(time_labels):
            table_row = TableRow()
            table_row.addElement(_ods_text_cell(label))
            for cell_value in grid[row_index]:
                if cell_value == 'covered':
                    table_row.addElement(CoveredTableCell())
                elif cell_value is None:
                    table_row.addElement(_ods_text_cell(''))
                else:
                    cell = TableCell(valuetype='string', numberrowsspanned=cell_value['row_span'])
                    for line in cell_value['text'].split('\n'):
                        cell.addElement(P(text=line))
                    table_row.addElement(cell)
            table.addElement(table_row)
        doc.spreadsheet.addElement(table)

    buf = BytesIO()
    doc.write(buf)
    buf.seek(0)
    return buf


def send_xlsx_multisheet(filename, sheets):
    buf = generate_xlsx_multisheet(sheets)
    return send_file(filename, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     inline=False)


def send_ods(filename, sheets):
    buf = generate_ods(sheets)
    return send_file(filename, buf, 'application/vnd.oasis.opendocument.spreadsheet', inline=False)
