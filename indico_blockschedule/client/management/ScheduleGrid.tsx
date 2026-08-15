// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import {Translate} from 'indico/react/i18n';
import React, {useState} from 'react';
import {Button, Checkbox, Dropdown, Icon, Input} from 'semantic-ui-react';

import {paleBackground, readableTextColor} from '../colors';
import {ContributionBlock} from '../ContributionBlock';
import {buildSlots, durationToPx, GUTTER_PX, minutesToLabel, minutesToOffsetPx, parseTimeToMinutes} from '../gridTime';
import {BSContribution, BSGridData} from '../types';

import './ScheduleGrid.module.scss';

const COLUMN_DRAG_TYPE = 'application/x-bs-column';
const SPANNING_DRAG_TYPE = 'application/x-bs-spanning';

// A transparent 1x1 GIF, used as the native drag image (see `setDragImage` below) -- the
// browser's own drag-image snapshot is rendered in a compositing layer above *everything* on
// the page, including elements with the highest possible `z-index`, so a real DOM element
// (like the time tooltip) can never appear on top of it. Suppressing it with this and
// rendering our own cursor-following ghost box instead keeps everything in the normal page
// stacking order, where z-index actually works.
const EMPTY_DRAG_IMAGE = typeof Image !== 'undefined' ? new Image() : null;
if (EMPTY_DRAG_IMAGE) {
  EMPTY_DRAG_IMAGE.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
}

type AddFormKey = 'column' | 'spanning' | 'session';

// The labels are functions rather than strings so that `Translate` runs at render time: a
// module-level `Translate.string(...)` would be evaluated at import time, before the page's
// translations are in place.
const ADD_FORMS: {key: AddFormKey; label: () => React.ReactNode}[] = [
  {key: 'column', label: () => <Translate>Column</Translate>},
  {key: 'spanning', label: () => <Translate>Spanning block</Translate>},
  {key: 'session', label: () => <Translate>Session block</Translate>},
];

interface UpdateColumnData {
  label?: string;
  color?: string | null;
  min_width_px?: number;
}

interface UpdateSpanningBlockData {
  title?: string;
  start_minutes?: number;
  duration_minutes?: number;
  color?: string;
}

interface CreateSessionBlockData {
  session_id: number | null;
  title: string | null;
  start_minutes: number;
  duration_minutes: number;
  color: string | null;
  column_ids: number[] | null;
}

interface UpdateSessionBlockData {
  start_minutes?: number;
  duration_minutes?: number;
  color?: string;
  column_ids?: number[] | null;
}

interface ScheduleGridProps {
  eventId: number;
  gridData: BSGridData;
  /** Grey out talks outside the active track filter (their rooms are still shown). */
  isDimmed?: (contribution: BSContribution) => boolean;
  onSchedule: (contributionId: number, columnId: number, startMinutes: number) => void;
  onUnschedule: (contributionId: number) => void;
  onCreateColumn: (roomId: number | null, label: string, color: string | null) => void;
  onUpdateColumn: (columnId: number, data: UpdateColumnData) => void;
  onDeleteColumn: (columnId: number) => void;
  onReorderColumns: (columnIds: number[]) => void;
  onCreateSpanningBlock: (
    title: string,
    startMinutes: number,
    durationMinutes: number,
    color: string | null
  ) => void;
  onUpdateSpanningBlock: (entryId: number, data: UpdateSpanningBlockData) => void;
  onDeleteSpanningBlock: (entryId: number) => void;
  onCreateSessionBlock: (data: CreateSessionBlockData) => void;
  onUpdateSessionBlock: (blockId: number, data: UpdateSessionBlockData) => void;
  onDeleteSessionBlock: (blockId: number) => void;
}

/** Candidate start minute closest to `rawStart`, snapping to a neighbor's edge (± the gap) if within one slot. */
function snapStart(
  rawStart: number,
  durationMinutes: number,
  columnId: number,
  contributionId: number,
  gridData: BSGridData
): number {
  if (gridData.gap_minutes <= 0) {
    return rawStart;
  }
  const neighbors = gridData.scheduled_contributions.filter(
    c => c.column_id === columnId && c.id !== contributionId && c.start_minutes !== null
  );
  let best = rawStart;
  let bestDist = gridData.slot_minutes;
  for (const neighbor of neighbors) {
    const neighborStart = neighbor.start_minutes as number;
    const candidates = [
      neighborStart + (neighbor.duration_minutes ?? 0) + gridData.gap_minutes,
      neighborStart - gridData.gap_minutes - durationMinutes,
    ];
    for (const candidate of candidates) {
      const dist = Math.abs(candidate - rawStart);
      if (dist <= bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
  }
  return Math.max(0, best);
}

function ColumnHeader({
  column,
  onUpdate,
  onDelete,
  onDragStart,
  onDropColumn,
}: {
  column: BSGridData['columns'][number];
  onUpdate: (data: UpdateColumnData) => void;
  onDelete: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDropColumn: (event: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.title);

  const backgroundColor = column.color ? `#${column.color}` : undefined;
  const color = column.color ? readableTextColor(`#${column.color}`) : undefined;

  if (editing) {
    return (
      <Input
        size="mini"
        autoFocus
        value={value}
        onChange={(_e, {value: v}) => setValue(v)}
        onBlur={() => {
          setEditing(false);
          if (value.trim() && value !== column.title) {
            onUpdate({label: value.trim()});
          }
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  }

  return (
    <div
      styleName="column-header"
      style={{backgroundColor, color}}
      draggable
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDropColumn}
      onClick={() => setEditing(true)}
    >
      <span>{column.title}</span>
      <input
        type="number"
        min={0}
        step={10}
        title={Translate.string('Minimum column width (px), 0 for no minimum')}
        styleName="width-input"
        defaultValue={column.min_width_px ?? ''}
        placeholder="px"
        onClick={e => e.stopPropagation()}
        onBlur={e => {
          const widthPx = Number(e.target.value);
          if (!Number.isNaN(widthPx) && widthPx !== (column.min_width_px ?? 0)) {
            onUpdate({min_width_px: widthPx});
          }
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <input
        type="color"
        styleName="color-input"
        value={column.color ? `#${column.color}` : '#cccccc'}
        onClick={e => e.stopPropagation()}
        onChange={e => onUpdate({color: e.target.value.replace('#', '')})}
      />
      <Icon name="close" size="small" styleName="delete-icon" onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
      }} />
    </div>
  );
}

function AddColumnForm({
  roombookingEnabled,
  rooms,
  onCreateColumn,
}: {
  roombookingEnabled: boolean;
  rooms: BSGridData['rooms'];
  onCreateColumn: (roomId: number | null, label: string, color: string | null) => void;
}) {
  const [roomId, setRoomId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<string | null>(null);

  const submit = () => {
    if (!label.trim()) {
      return;
    }
    onCreateColumn(roomId, label.trim(), color);
    setRoomId(null);
    setLabel('');
    setColor(null);
  };

  return (
    <div styleName="add-column">
      {roombookingEnabled && (
        <Dropdown
          placeholder={Translate.string('Pick a room (optional)…')}
          selection
          search
          clearable
          options={rooms.map(r => ({key: r.id, value: r.id, text: r.full_name}))}
          value={roomId ?? undefined}
          onChange={(_e, {value}) => {
            const newRoomId = (value as number) ?? null;
            setRoomId(newRoomId);
            if (newRoomId && !label.trim()) {
              setLabel(rooms.find(r => r.id === newRoomId)?.full_name ?? '');
            }
          }}
        />
      )}
      <Input
        placeholder={Translate.string('Column name')}
        value={label}
        onChange={(_e, {value}) => setLabel(value)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
            submit();
          }
        }}
      />
      <input
        type="color"
        value={color ?? '#cccccc'}
        onChange={e => setColor(e.target.value.replace('#', ''))}
      />
      <Button primary disabled={!label.trim()} onClick={submit}>
        <Translate>Add column</Translate>
      </Button>
    </div>
  );
}

function AddSpanningBlockForm({
  slots,
  onCreateSpanningBlock,
}: {
  slots: number[];
  onCreateSpanningBlock: (title: string, startMinutes: number, durationMinutes: number, color: string | null) => void;
}) {
  const [title, setTitle] = useState('');
  const [startMinutes, setStartMinutes] = useState(slots[0] ?? 0);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [color, setColor] = useState('e0e0e0');

  const submit = () => {
    if (!title.trim() || durationMinutes <= 0) {
      return;
    }
    onCreateSpanningBlock(title.trim(), startMinutes, durationMinutes, color);
    setTitle('');
  };

  return (
    <div styleName="add-spanning-block">
      <Input
        placeholder={Translate.string('Spanning block title (e.g. Lunch break)')}
        value={title}
        onChange={(_e, {value}) => setTitle(value)}
      />
      <select value={startMinutes} onChange={e => setStartMinutes(Number(e.target.value))}>
        {slots.map(slotMinutes => (
          <option key={slotMinutes} value={slotMinutes}>
            {minutesToLabel(slotMinutes)}
          </option>
        ))}
      </select>
      <Input
        type="number"
        min={5}
        step={5}
        value={durationMinutes}
        onChange={(_e, {value}) => setDurationMinutes(Number(value))}
        label={Translate.string('min')}
        labelPosition="right"
      />
      <input type="color" value={`#${color}`} onChange={e => setColor(e.target.value.replace('#', ''))} />
      <Button primary disabled={!title.trim()} onClick={submit}>
        <Translate>Add spanning block</Translate>
      </Button>
    </div>
  );
}

function SpanningBlockBar({
  block,
  gridData,
  onUpdate,
  onDelete,
  onDragStart,
}: {
  block: BSGridData['spanning_blocks'][number];
  gridData: BSGridData;
  onUpdate: (data: UpdateSpanningBlockData) => void;
  onDelete: () => void;
  onDragStart: (event: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(block.title);
  const backgroundColor = block.color ? `#${block.color}` : undefined;
  const color = block.color ? readableTextColor(`#${block.color}`) : undefined;

  return (
    <div
      styleName="spanning-block"
      draggable={!editing}
      onDragStart={onDragStart}
      style={{
        top: minutesToOffsetPx(block.start_minutes, gridData.day_start_time, gridData.slot_minutes,
                               gridData.row_height_px),
        height: durationToPx(block.duration_minutes, gridData.slot_minutes, gridData.row_height_px),
        left: GUTTER_PX,
        backgroundColor,
        color,
      }}
    >
      {editing ? (
        <Input
          size="mini"
          autoFocus
          value={value}
          onChange={(_e, {value: v}) => setValue(v)}
          onBlur={() => {
            setEditing(false);
            if (value.trim() && value !== block.title) {
              onUpdate({title: value.trim()});
            }
          }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      ) : (
        <span onClick={() => setEditing(true)}>{block.title}</span>
      )}
      <input
        type="color"
        styleName="color-input"
        value={block.color ? `#${block.color}` : '#e0e0e0'}
        onClick={e => e.stopPropagation()}
        onChange={e => onUpdate({color: e.target.value.replace('#', '')})}
      />
      <Icon name="close" size="small" styleName="unschedule-icon" onClick={onDelete} />
    </div>
  );
}

function AddSessionBlockForm({
  slots,
  sessions,
  columns,
  onCreateSessionBlock,
}: {
  slots: number[];
  sessions: BSGridData['sessions'];
  columns: BSGridData['columns'];
  onCreateSessionBlock: (data: CreateSessionBlockData) => void;
}) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [startMinutes, setStartMinutes] = useState(slots[0] ?? 0);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [color, setColor] = useState('e3f2d3');
  const [columnIds, setColumnIds] = useState<number[] | null>(null);

  const session = sessions.find(s => s.id === sessionId) ?? null;
  const effectiveTitle = title.trim() || session?.title || '';

  const toggleColumn = (columnId: number) => {
    const allIds = columns.map(c => c.id);
    const current = columnIds ?? allIds;
    const next = current.includes(columnId) ? current.filter(id => id !== columnId) : [...current, columnId];
    setColumnIds(next.length === allIds.length ? null : next);
  };

  const submit = () => {
    if (!effectiveTitle || durationMinutes <= 0) {
      return;
    }
    onCreateSessionBlock({
      session_id: sessionId,
      title: title.trim() || null,
      start_minutes: startMinutes,
      duration_minutes: durationMinutes,
      color: session ? null : color,
      column_ids: columnIds,
    });
    setTitle('');
  };

  return (
    <div styleName="add-session-block">
      {sessions.length > 0 && (
        <Dropdown
          placeholder={Translate.string('Pick a session (optional)…')}
          selection
          clearable
          options={sessions.map(s => ({key: s.id, value: s.id, text: s.title}))}
          value={sessionId ?? undefined}
          onChange={(_e, {value}) => setSessionId((value as number) ?? null)}
        />
      )}
      <Input
        placeholder={Translate.string('Session block title')}
        value={title}
        onChange={(_e, {value}) => setTitle(value)}
      />
      <select value={startMinutes} onChange={e => setStartMinutes(Number(e.target.value))}>
        {slots.map(slotMinutes => (
          <option key={slotMinutes} value={slotMinutes}>
            {minutesToLabel(slotMinutes)}
          </option>
        ))}
      </select>
      <Input
        type="number"
        min={5}
        step={5}
        value={durationMinutes}
        onChange={(_e, {value}) => setDurationMinutes(Number(value))}
        label={Translate.string('min')}
        labelPosition="right"
      />
      {!session && (
        <input type="color" value={`#${color}`} onChange={e => setColor(e.target.value.replace('#', ''))} />
      )}
      <div styleName="column-picker">
        {columns.map(column => (
          <Checkbox
            key={column.id}
            label={column.title}
            checked={columnIds === null || columnIds.includes(column.id)}
            onChange={() => toggleColumn(column.id)}
          />
        ))}
      </div>
      <Button primary disabled={!effectiveTitle} onClick={submit}>
        <Translate>Add session block</Translate>
      </Button>
    </div>
  );
}

function SessionBlockBar({
  block,
  column,
  gridData,
  onUpdate,
  onDelete,
}: {
  block: BSGridData['session_blocks'][number];
  column: BSGridData['columns'][number];
  gridData: BSGridData;
  onUpdate: (data: UpdateSessionBlockData) => void;
  onDelete: () => void;
}) {
  const backgroundColor = block.color ? `#${block.color}` : '#e3f2d3';
  const color = readableTextColor(backgroundColor);
  // gridData.columns is already ordered by position -- the title is only shown once, on
  // whichever spanned column comes first in that order, so a multi-column block reads as a
  // single continuous banner rather than repeating its title in every segment.
  const spannedIds = block.column_ids ?? gridData.columns.map(c => c.id);
  const firstSpannedColumn = gridData.columns.find(c => spannedIds.includes(c.id));
  const isFirstSpannedColumn = firstSpannedColumn?.id === column.id;

  return (
    <div
      styleName="session-block"
      style={{
        top: minutesToOffsetPx(block.start_minutes, gridData.day_start_time, gridData.slot_minutes,
                               gridData.row_height_px),
        height: durationToPx(block.duration_minutes, gridData.slot_minutes, gridData.row_height_px),
        backgroundColor,
        color,
      }}
    >
      {isFirstSpannedColumn && <span styleName="session-block-title">{block.title}</span>}
      <input
        type="color"
        styleName="color-input"
        value={block.color ? `#${block.color}` : '#e3f2d3'}
        onClick={e => e.stopPropagation()}
        onChange={e => onUpdate({color: e.target.value.replace('#', '')})}
      />
      <Icon name="close" size="small" styleName="unschedule-icon" onClick={onDelete} />
    </div>
  );
}

export function ScheduleGrid({
  eventId,
  gridData,
  isDimmed,
  onSchedule,
  onUnschedule,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onReorderColumns,
  onCreateSpanningBlock,
  onUpdateSpanningBlock,
  onDeleteSpanningBlock,
  onCreateSessionBlock,
  onUpdateSessionBlock,
  onDeleteSessionBlock,
}: ScheduleGridProps) {
  const slots = buildSlots(gridData.day_start_time, gridData.day_end_time, gridData.slot_minutes);
  const rowHeightPx = gridData.row_height_px;
  const bodyHeight = slots.length * rowHeightPx;
  const contributionsById = new Map(
    [...gridData.scheduled_contributions, ...gridData.unscheduled_contributions].map(c => [c.id, c])
  );

  // Which of the "add" forms is expanded, if any -- one at a time (see the panel below).
  const [openForm, setOpenForm] = useState<AddFormKey | null>(null);

  const dayStartMinutes = parseTimeToMinutes(gridData.day_start_time);
  const workingHoursStart = parseTimeToMinutes(gridData.working_hours_start);
  const workingHoursEnd = parseTimeToMinutes(gridData.working_hours_end);

  // The contribution currently being dragged (set at its own onDragStart) and where it would
  // land if dropped right now (recomputed on every dragover) -- drives both the live
  // time-range preview on the dragged block itself, and a floating tooltip that follows the
  // cursor (a stand-in "ghost" highlight: the browser's native drag-image snapshot is taken
  // once at dragstart and can't be updated mid-drag, so a custom cursor-following element is
  // the only way to show a *moving* highlight of the prospective time). `dataTransfer.getData`
  // can't be read during `dragover` (browsers only expose `.types` then, not the actual
  // payload), so which contribution is being dragged has to be tracked via React state instead.
  const [draggingContribution, setDraggingContribution] = useState<BSGridData['scheduled_contributions'][number] | null>(null);
  const [dragPreview, setDragPreview] = useState<
    {contributionId: number; startMinutes: number; clientX: number; clientY: number} | null
  >(null);
  // Where, within the dragged block, the cursor grabbed it, and the block's own size --
  // captured once at dragstart -- so the floating time tooltip can be anchored to the
  // *ghost's* bottom-right corner (cursor position - grab offset + block size) as it moves,
  // rather than just sitting at a fixed offset from the cursor itself.
  const [dragGrabOffset, setDragGrabOffset] = useState<
    {offsetX: number; offsetY: number; width: number; height: number} | null
  >(null);

  const clearDrag = () => {
    setDraggingContribution(null);
    setDragPreview(null);
    setDragGrabOffset(null);
  };

  /** Raw drop position (minute-of-day), from the pointer's offset within the column track,
   * rounded to the nearest `snap_minutes` (or left at whole-minute precision when snapping
   * is disabled). Distinct from `snapStart`'s GapSnap neighbor-edge snapping, which runs on
   * top of this. */
  const dropMinutes = (event: React.DragEvent<HTMLElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetPx = event.clientY - rect.top;
    const raw = dayStartMinutes + (offsetPx / rowHeightPx) * gridData.slot_minutes;
    const snap = gridData.snap_minutes;
    return Math.max(dayStartMinutes, snap > 0 ? Math.round(raw / snap) * snap : Math.round(raw));
  };

  const onTrackDragOver = (event: React.DragEvent<HTMLDivElement>, columnId: number) => {
    event.preventDefault();
    if (!draggingContribution) {
      return;
    }
    const slotMinutes = dropMinutes(event);
    const startMinutes = snapStart(
      slotMinutes, draggingContribution.duration_minutes ?? 0, columnId, draggingContribution.id, gridData
    );
    setDragPreview(prev =>
      prev && prev.contributionId === draggingContribution.id && prev.startMinutes === startMinutes
       && prev.clientX === event.clientX && prev.clientY === event.clientY
        ? prev
        : {contributionId: draggingContribution.id, startMinutes, clientX: event.clientX, clientY: event.clientY}
    );
  };

  const onTrackDrop = (event: React.DragEvent<HTMLDivElement>, columnId: number) => {
    event.preventDefault();
    const slotMinutes = dropMinutes(event);
    if (event.dataTransfer.types.includes(SPANNING_DRAG_TYPE)) {
      const entryId = Number(event.dataTransfer.getData(SPANNING_DRAG_TYPE));
      if (entryId) {
        onUpdateSpanningBlock(entryId, {start_minutes: slotMinutes});
      }
      return;
    }
    const contributionId = Number(event.dataTransfer.getData('text/plain'));
    if (!contributionId) {
      return;
    }
    const contribution = contributionsById.get(contributionId);
    const durationMinutes = contribution?.duration_minutes ?? 0;
    const startMinutes = contribution
      ? snapStart(slotMinutes, durationMinutes, columnId, contributionId, gridData)
      : slotMinutes;
    // Outside the event's configured working hours: bounce back -- no request sent, the
    // dragged block just snaps back to wherever it was before the drop.
    if (startMinutes < workingHoursStart || startMinutes + durationMinutes > workingHoursEnd) {
      return;
    }
    // Would overlap another contribution already in this column: bounce back too. This is
    // just an instant client-side check to avoid a pointless round trip -- the server enforces
    // the same rule (and is the actual source of truth, e.g. against concurrent edits).
    const endMinutes = startMinutes + durationMinutes;
    const overlaps = gridData.scheduled_contributions.some(
      c =>
        c.column_id === columnId &&
        c.id !== contributionId &&
        c.start_minutes !== null &&
        startMinutes < (c.start_minutes as number) + (c.duration_minutes ?? 0) &&
        (c.start_minutes as number) < endMinutes
    );
    if (overlaps) {
      return;
    }
    onSchedule(contributionId, columnId, startMinutes);
  };

  const onHeaderDrop = (event: React.DragEvent, targetColumnId: number) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) {
      return;
    }
    const draggedId = Number(event.dataTransfer.getData(COLUMN_DRAG_TYPE));
    if (!draggedId || draggedId === targetColumnId) {
      return;
    }
    const order = gridData.columns.map(c => c.id);
    const fromIndex = order.indexOf(draggedId);
    const toIndex = order.indexOf(targetColumnId);
    order.splice(fromIndex, 1);
    order.splice(toIndex, 0, draggedId);
    onReorderColumns(order);
  };

  return (
    <div styleName="grid-wrapper">
      {/* At the top of the workspace, not the bottom: these three forms used to sit below a
          grid that is routinely taller than the scroll box, so adding a column meant scrolling
          past the whole day to find the control and then scrolling back. Only one form is open
          at a time -- three permanently expanded forms would push the grid itself off-screen,
          which is the same problem in a different place. */}
      <div styleName="add-panel">
        <div styleName="add-bar">
          {ADD_FORMS.map(({key, label}) => (
            <Button
              key={key}
              size="small"
              toggle
              active={openForm === key}
              aria-expanded={openForm === key}
              onClick={() => setOpenForm(openForm === key ? null : key)}
            >
              <Icon name={openForm === key ? 'minus' : 'plus'} />
              {label()}
            </Button>
          ))}
        </div>
        {openForm === 'column' && (
          <AddColumnForm
            roombookingEnabled={gridData.roombooking_enabled}
            rooms={gridData.rooms}
            onCreateColumn={onCreateColumn}
          />
        )}
        {openForm === 'spanning' && (
          <AddSpanningBlockForm slots={slots} onCreateSpanningBlock={onCreateSpanningBlock} />
        )}
        {openForm === 'session' && (
          <AddSessionBlockForm
            slots={slots}
            sessions={gridData.sessions}
            columns={gridData.columns}
            onCreateSessionBlock={onCreateSessionBlock}
          />
        )}
      </div>

      <div styleName="header-row">
        <div styleName="corner" style={{width: GUTTER_PX}} />
        {gridData.columns.map(column => (
          <div
            key={column.id}
            styleName="header-cell"
            style={column.min_width_px ? {minWidth: column.min_width_px} : undefined}
          >
            <ColumnHeader
              column={column}
              onUpdate={data => onUpdateColumn(column.id, data)}
              onDelete={() => onDeleteColumn(column.id)}
              onDragStart={e => e.dataTransfer.setData(COLUMN_DRAG_TYPE, String(column.id))}
              onDropColumn={e => onHeaderDrop(e, column.id)}
            />
          </div>
        ))}
      </div>

      <div styleName="body-row">
        <div styleName="time-gutter" style={{width: GUTTER_PX}}>
          {slots.map(slotMinutes => (
            <div key={slotMinutes} styleName="time-label" style={{height: rowHeightPx}}>
              {minutesToLabel(slotMinutes)}
            </div>
          ))}
        </div>

        {gridData.columns.map(column => (
          <div
            key={column.id}
            styleName="column-track"
            style={{
              height: bodyHeight,
              minWidth: column.min_width_px || undefined,
              backgroundColor: column.color ? paleBackground(`#${column.color}`) : undefined,
            }}
            onDragOver={e => onTrackDragOver(e, column.id)}
            onDrop={e => {
              onTrackDrop(e, column.id);
              clearDrag();
            }}
          >
            {slots.map(slotMinutes => (
              <div
                key={slotMinutes}
                styleName={
                  slotMinutes < workingHoursStart || slotMinutes >= workingHoursEnd
                    ? 'cell cell-outside-hours'
                    : 'cell'
                }
                style={{height: rowHeightPx}}
              />
            ))}
            {gridData.scheduled_contributions
              .filter(c => c.column_id === column.id && c.start_minutes !== null)
              .map(contribution => (
                <div
                  key={contribution.id}
                  styleName="scheduled-block"
                  style={{
                    top: minutesToOffsetPx(contribution.start_minutes as number, gridData.day_start_time,
                                          gridData.slot_minutes, rowHeightPx),
                    height: durationToPx(contribution.duration_minutes, gridData.slot_minutes, rowHeightPx),
                  }}
                >
                  <ContributionBlock
                    contribution={contribution}
                    eventId={eventId}
                    dimmed={isDimmed?.(contribution)}
                    draggable
                    showSessionTrack={gridData.show_session_track}
                    titleMaxLines={gridData.title_max_lines}
                    previewStartMinutes={
                      dragPreview?.contributionId === contribution.id ? dragPreview.startMinutes : null
                    }
                    onDragStart={(e, c) => {
                      e.dataTransfer.setData('text/plain', String(c.id));
                      if (EMPTY_DRAG_IMAGE) {
                        e.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
                      }
                      setDraggingContribution(c);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDragGrabOffset({
                        offsetX: e.clientX - rect.left,
                        offsetY: e.clientY - rect.top,
                        width: rect.width,
                        height: rect.height,
                      });
                    }}
                    onDragEnd={clearDrag}
                    style={{height: '100%'}}
                  />
                  <Icon
                    name="close"
                    size="small"
                    styleName="unschedule-icon"
                    onClick={() => onUnschedule(contribution.id)}
                  />
                </div>
              ))}
            {gridData.session_blocks
              .filter(block => block.column_ids === null || block.column_ids.includes(column.id))
              .map(block => (
                <SessionBlockBar
                  key={block.id}
                  block={block}
                  column={column}
                  gridData={gridData}
                  onUpdate={data => onUpdateSessionBlock(block.id, data)}
                  onDelete={() => onDeleteSessionBlock(block.id)}
                />
              ))}
          </div>
        ))}

        {gridData.spanning_blocks.map(block => (
          <SpanningBlockBar
            key={block.id}
            block={block}
            gridData={gridData}
            onUpdate={data => onUpdateSpanningBlock(block.id, data)}
            onDelete={() => onDeleteSpanningBlock(block.id)}
            onDragStart={e => e.dataTransfer.setData(SPANNING_DRAG_TYPE, String(block.id))}
          />
        ))}
      </div>

      {dragPreview && draggingContribution && dragGrabOffset && (
        // The native drag image is suppressed entirely (see `EMPTY_DRAG_IMAGE`/`setDragImage`
        // above), since it always renders in a browser compositing layer above the whole page
        // -- no `z-index` on a real element can ever appear on top of it. This is a full
        // stand-in instead: a cursor-following box the same size/position the native ghost
        // would have had, with the live time tooltip anchored to its bottom-right corner --
        // both real DOM, so normal stacking rules (and our very high `z-index`) actually apply.
        <div
          styleName="drag-ghost-box"
          style={{
            left: dragPreview.clientX - dragGrabOffset.offsetX,
            top: dragPreview.clientY - dragGrabOffset.offsetY,
            width: dragGrabOffset.width,
            height: dragGrabOffset.height,
          }}
        >
          <div styleName="drag-ghost-title">{draggingContribution.title}</div>
          <div styleName="drag-ghost-tooltip">
            {minutesToLabel(dragPreview.startMinutes)}–
            {minutesToLabel(dragPreview.startMinutes + (draggingContribution.duration_minutes ?? 0))}
          </div>
        </div>
      )}
    </div>
  );
}
