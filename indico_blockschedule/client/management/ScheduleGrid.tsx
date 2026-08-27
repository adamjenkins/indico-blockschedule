// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Checkbox, Confirm, Dropdown, Icon, Input} from 'semantic-ui-react';

import {paleBackground, readableTextColor, trackColorMap} from '../colors';
import {ContributionBlock} from '../ContributionBlock';
import {buildSlots, durationToPx, GUTTER_PX, minutesToLabel, minutesToOffsetPx, parseTimeToMinutes} from '../gridTime';
import {Translate} from '../i18n';
import {BSContribution, BSGridData} from '../types';

import {ContributionDragState} from './contributionDrag';

import './ScheduleGrid.module.scss';

const COLUMN_DRAG_TYPE = 'application/x-bs-column';
const SPANNING_DRAG_TYPE = 'application/x-bs-spanning';

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
  /** The contribution drag in progress, if any -- owned by `ManageApp` because a drag can
   * start here or in the unscheduled panel, and this grid draws the preview for both. */
  contributionDrag: ContributionDragState | null;
  /** Where the delete-confirmation dialog portals to -- inside the fullscreenable container,
   * or it would be invisible (and focus-trapping) whenever the grid is fullscreen. */
  mountNode?: HTMLElement;
  onContributionDragStart: (event: React.DragEvent, contribution: BSContribution) => void;
  onContributionDragEnd: () => void;
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

/**
 * A column's empty background cells.
 *
 * Memoised, and pulled out into its own component so that it can be: on a
 * 20-room grid at 15-minute slots this is around a thousand divs that depend on
 * nothing a drag changes, and rebuilding them on every pointer move was most of
 * the cost of dragging a block across the page.
 */
const ColumnCells = React.memo(({
  slots,
  rowHeightPx,
  workingHoursStart,
  workingHoursEnd,
}: {
  slots: number[];
  rowHeightPx: number;
  workingHoursStart: number;
  workingHoursEnd: number;
}) => (
  <>
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
  </>
));
ColumnCells.displayName = 'ColumnCells';


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
    >
      {/* Click-to-edit lives on the title alone, so the delete icon at the other end of the
          header is not a stray click away from a surface the manager hits routinely to
          rename. */}
      <span styleName="column-title" onClick={() => setEditing(true)}>{column.title}</span>
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
  contributionDragActive,
  onUpdate,
  onDelete,
  onDragStart,
}: {
  block: BSGridData['spanning_blocks'][number];
  gridData: BSGridData;
  /** True while a contribution is being dragged anywhere on the page. */
  contributionDragActive: boolean;
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
      // The bar renders across the full grid width as a sibling of the column tracks, and has
      // no drop handlers of its own -- so while a contribution drag is live it must let
      // pointer events fall through (`spanning-block-inert`), or its whole time band becomes
      // a dead drop zone across every column at once. Outside a drag it stays interactive:
      // its own drag handle, colour input and close icon all need the pointer.
      styleName={contributionDragActive ? 'spanning-block spanning-block-inert' : 'spanning-block'}
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
  contributionDrag,
  mountNode,
  onContributionDragStart,
  onContributionDragEnd,
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
  // Memoised so the derived objects keep their identity between renders. Without
  // this every render rebuilt the slot list, a 200-entry Map and the colour map,
  // and handed `ColumnCells` a fresh `slots` array so it could never bail out.
  const rowHeightPx = gridData.row_height_px;
  const slots = useMemo(
    () => buildSlots(gridData.day_start_time, gridData.day_end_time, gridData.slot_minutes),
    [gridData.day_start_time, gridData.day_end_time, gridData.slot_minutes]
  );
  const bodyHeight = slots.length * rowHeightPx;
  const contributionsById = useMemo(
    () => new Map(
      [...gridData.scheduled_contributions, ...(gridData.unscheduled_contributions ?? [])].map(
        c => [c.id, c]
      )
    ),
    [gridData.scheduled_contributions, gridData.unscheduled_contributions]
  );
  const trackColors = useMemo(() => trackColorMap(gridData.tracks), [gridData.tracks]);
  const contributionsByColumn = useMemo(() => {
    const byColumn = new Map<number, BSContribution[]>();
    for (const contribution of gridData.scheduled_contributions) {
      if (contribution.column_id === null || contribution.start_minutes === null) {
        continue;
      }
      const list = byColumn.get(contribution.column_id);
      if (list) {
        list.push(contribution);
      } else {
        byColumn.set(contribution.column_id, [contribution]);
      }
    }
    return byColumn;
  }, [gridData.scheduled_contributions]);

  // Which of the "add" forms is expanded, if any -- one at a time (see the panel below).
  const [openForm, setOpenForm] = useState<AddFormKey | null>(null);

  // The destructive action awaiting confirmation, if any. Column, spanning-block and
  // session-block deletes all funnel through one dialog that names what a confirming click
  // costs -- none of them can be undone, and the column `x` in particular used to fire on a
  // single stray click.
  const [pendingDelete, setPendingDelete] = useState<{message: string; run: () => void} | null>(null);

  const confirmDeleteColumn = (column: BSGridData['columns'][number]) => {
    const count = gridData.scheduled_contributions.filter(c => c.column_id === column.id).length;
    setPendingDelete({
      message: count
        ? Translate.string(
            'Delete "{name}"? {count} scheduled contribution(s) will be moved back to the unscheduled list.',
            {name: column.title, count}
          )
        : Translate.string('Delete the empty column "{name}"?', {name: column.title}),
      run: () => onDeleteColumn(column.id),
    });
  };

  const confirmDeleteSpanningBlock = (block: BSGridData['spanning_blocks'][number]) => {
    setPendingDelete({
      message: Translate.string('Delete the spanning block "{title}"?', {title: block.title}),
      run: () => onDeleteSpanningBlock(block.id),
    });
  };

  const confirmDeleteSessionBlock = (block: BSGridData['session_blocks'][number]) => {
    setPendingDelete({
      message: block.title
        ? Translate.string('Delete the session block "{title}"?', {title: block.title})
        : Translate.string('Delete this session block?'),
      run: () => onDeleteSessionBlock(block.id),
    });
  };

  const dayStartMinutes = parseTimeToMinutes(gridData.day_start_time);
  const workingHoursStart = parseTimeToMinutes(gridData.working_hours_start);
  const workingHoursEnd = parseTimeToMinutes(gridData.working_hours_end);

  // The contribution currently being dragged and where it would land if dropped right now
  // (recomputed on every dragover) -- drives both the live time-range preview on the dragged
  // block itself, and a floating tooltip that follows the cursor (a stand-in "ghost"
  // highlight: the browser's native drag-image snapshot is taken once at dragstart and can't
  // be updated mid-drag, so a custom cursor-following element is the only way to show a
  // *moving* highlight of the prospective time). `dataTransfer.getData` can't be read during
  // `dragover` (browsers only expose `.types` then, not the actual payload), so which
  // contribution is being dragged has to be tracked as state instead -- and that state comes
  // down from `ManageApp` (`contributionDrag`), because a drag can start in the unscheduled
  // panel just as well as here, and both must get the same ghost and preview.
  const draggingContribution = contributionDrag?.contribution ?? null;
  // Where, within the dragged block, the cursor grabbed it, and the block's own size --
  // captured once at dragstart -- so the floating time tooltip can be anchored to the
  // *ghost's* bottom-right corner (cursor position - grab offset + block size) as it moves,
  // rather than just sitting at a fixed offset from the cursor itself.
  const dragGrabOffset = contributionDrag?.grabOffset ?? null;
  // Only the snapped start minute (plus the refusal it would trigger, if any) lives in
  // state. The pointer position used to live here too, which made every pixel of movement a
  // state change on this component -- and with a 20-room grid that is ~2,000 React elements
  // reconciled per mouse move, which is why the ghost trailed the cursor. The start minute
  // changes at snap granularity, so most moves now change nothing.
  const [dragPreview, setDragPreview] = useState<
    {contributionId: number; startMinutes: number; refusalReason: string | null} | null
  >(null);

  // Mirrored into a ref so the animation frame can read it without the callback
  // having to be rebuilt (and the frame rescheduled) whenever it changes.
  const dragGrabOffsetRef = useRef(dragGrabOffset);
  dragGrabOffsetRef.current = dragGrabOffset;

  // The ghost still has to follow the cursor every pixel, so it does that
  // outside React: the pointer goes into a ref and one animation frame writes a
  // transform straight onto the node.
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{x: number; y: number} | null>(null);
  const ghostFrameRef = useRef<number | null>(null);

  const positionGhost = useCallback(() => {
    ghostFrameRef.current = null;
    const node = ghostRef.current;
    const pointer = pointerRef.current;
    const offset = dragGrabOffsetRef.current;
    if (!node || !pointer || !offset) {
      return;
    }
    // The ghost mounts hidden (see its inline style) and only shows once it has a real
    // position, so it never flashes at the container's top-left corner first.
    node.style.visibility = 'visible';
    node.style.transform = `translate(${pointer.x - offset.offsetX}px, ${pointer.y - offset.offsetY}px)`;
  }, []);

  const trackPointer = useCallback((clientX: number, clientY: number) => {
    pointerRef.current = {x: clientX, y: clientY};
    if (ghostFrameRef.current === null) {
      ghostFrameRef.current = window.requestAnimationFrame(positionGhost);
    }
  }, [positionGhost]);

  // Pointer tracking is document-wide for the whole drag: per-track `dragover` handlers
  // would lose the ghost between the panel and the grid (and over anything without its own
  // handler), and a drag that starts in the unscheduled panel spends its first stretch
  // outside any column track.
  useEffect(() => {
    if (!contributionDrag) {
      return undefined;
    }
    const onDocumentDragOver = (event: DragEvent) => trackPointer(event.clientX, event.clientY);
    document.addEventListener('dragover', onDocumentDragOver);
    return () => document.removeEventListener('dragover', onDocumentDragOver);
  }, [contributionDrag, trackPointer]);

  // The per-drag scratch state (preview, pointer, pending frame) resets whenever the drag
  // ends, wherever it ends: the dragend that clears `contributionDrag` can fire in the
  // unscheduled panel, which this component never hears about directly.
  useEffect(() => {
    if (!contributionDrag) {
      if (ghostFrameRef.current !== null) {
        window.cancelAnimationFrame(ghostFrameRef.current);
        ghostFrameRef.current = null;
      }
      pointerRef.current = null;
      setDragPreview(null);
    }
  }, [contributionDrag]);

  // The reason the last drop was refused, shown as a banner over the grid; it times out on
  // its own so a stale reason does not outlive the mistake it explains.
  const [dropRefusal, setDropRefusal] = useState<string | null>(null);
  const refusalTimerRef = useRef<number | null>(null);
  const hideDropRefusal = () => {
    if (refusalTimerRef.current !== null) {
      window.clearTimeout(refusalTimerRef.current);
      refusalTimerRef.current = null;
    }
    setDropRefusal(null);
  };
  const showDropRefusal = (message: string) => {
    if (refusalTimerRef.current !== null) {
      window.clearTimeout(refusalTimerRef.current);
    }
    refusalTimerRef.current = window.setTimeout(() => {
      refusalTimerRef.current = null;
      setDropRefusal(null);
    }, 5000);
    setDropRefusal(message);
  };
  useEffect(() => () => {
    if (refusalTimerRef.current !== null) {
      window.clearTimeout(refusalTimerRef.current);
    }
  }, []);

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

  /** Why dropping `contributionId` at `startMinutes` in `columnId` would be refused, or
   * null when it is allowed. One source of truth for both the dragover tint and the drop
   * itself, so the ghost can never promise a drop that would then bounce. It exists to
   * answer *during* `dragover`, where no request can be made -- the server enforces the
   * same rules and remains the actual authority (e.g. against concurrent edits). */
  const dropRefusalReason = (
    startMinutes: number,
    durationMinutes: number,
    columnId: number,
    contributionId: number
  ): string | null => {
    if (startMinutes < workingHoursStart || startMinutes + durationMinutes > workingHoursEnd) {
      return Translate.string('Outside working hours ({start}–{end})', {
        start: minutesToLabel(workingHoursStart),
        end: minutesToLabel(workingHoursEnd),
      });
    }
    const endMinutes = startMinutes + durationMinutes;
    const overlaps = gridData.scheduled_contributions.some(
      c =>
        c.column_id === columnId &&
        c.id !== contributionId &&
        c.start_minutes !== null &&
        startMinutes < (c.start_minutes as number) + (c.duration_minutes ?? 0) &&
        (c.start_minutes as number) < endMinutes
    );
    return overlaps ? Translate.string('Overlaps another contribution') : null;
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
    const refusalReason = dropRefusalReason(
      startMinutes, draggingContribution.duration_minutes ?? 0, columnId, draggingContribution.id
    );
    setDragPreview(prev =>
      prev &&
      prev.contributionId === draggingContribution.id &&
      prev.startMinutes === startMinutes &&
      prev.refusalReason === refusalReason
        ? prev
        : {contributionId: draggingContribution.id, startMinutes, refusalReason}
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
    // A refused drop names its reason instead of silently bouncing the block back to where
    // it started -- the banner spells out what the red ghost was warning about.
    const refusalReason = dropRefusalReason(startMinutes, durationMinutes, columnId, contributionId);
    if (refusalReason) {
      showDropRefusal(refusalReason);
      return;
    }
    hideDropRefusal();
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
    // `toIndex` is deliberately computed before the removal: remove-then-insert at the
    // pre-removal index is the standard array-move rule, and it lands the dragged column at
    // exactly the slot index it was dropped on, symmetrically in both directions.
    order.splice(fromIndex, 1);
    order.splice(toIndex, 0, draggedId);
    onReorderColumns(order);
  };

  return (
    <div styleName="grid-wrapper">
      {dropRefusal && (
        <div styleName="drop-refusal" role="alert">
          {dropRefusal}
        </div>
      )}
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
            rooms={gridData.rooms ?? []}
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
              onDelete={() => confirmDeleteColumn(column)}
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
              onContributionDragEnd();
            }}
          >
            <ColumnCells
              slots={slots}
              rowHeightPx={rowHeightPx}
              workingHoursStart={workingHoursStart}
              workingHoursEnd={workingHoursEnd}
            />
            {(contributionsByColumn.get(column.id) ?? [])
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
                    trackColor={
                      contribution.track_id === null ? null : trackColors.get(contribution.track_id)
                    }
                    titleMaxLines={gridData.title_max_lines}
                    previewStartMinutes={
                      dragPreview?.contributionId === contribution.id ? dragPreview.startMinutes : null
                    }
                    onDragStart={onContributionDragStart}
                    onDragEnd={onContributionDragEnd}
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
                  onDelete={() => confirmDeleteSessionBlock(block)}
                />
              ))}
          </div>
        ))}

        {gridData.spanning_blocks.map(block => (
          <SpanningBlockBar
            key={block.id}
            block={block}
            gridData={gridData}
            contributionDragActive={!!contributionDrag}
            onUpdate={data => onUpdateSpanningBlock(block.id, data)}
            onDelete={() => confirmDeleteSpanningBlock(block)}
            onDragStart={e => e.dataTransfer.setData(SPANNING_DRAG_TYPE, String(block.id))}
          />
        ))}
      </div>

      {draggingContribution && dragGrabOffset && (
        // The native drag image is suppressed entirely (see `startContributionDrag`), since
        // it always renders in a browser compositing layer above the whole page -- no
        // `z-index` on a real element can ever appear on top of it. This is a full stand-in
        // instead: a cursor-following box the same size/position the native ghost would have
        // had, with the live time tooltip anchored to its bottom-right corner -- both real
        // DOM, so normal stacking rules (and our very high `z-index`) actually apply. The
        // tint turns red the moment the position under the cursor would be refused, so a
        // doomed drop is telegraphed while it can still be steered somewhere valid.
        <div
          ref={node => {
            ghostRef.current = node;
            // Place it as soon as it exists, so the first frame is not at 0,0.
            positionGhost();
          }}
          styleName={dragPreview?.refusalReason ? 'drag-ghost-box drag-ghost-invalid' : 'drag-ghost-box'}
          style={{
            left: 0,
            top: 0,
            width: dragGrabOffset.width,
            height: dragGrabOffset.height,
            // Hidden until `positionGhost` has given it a real transform (a drag that starts
            // in the unscheduled panel mounts this before any pointer position is known).
            visibility: 'hidden',
          }}
        >
          <div styleName="drag-ghost-title">{draggingContribution.title}</div>
          {dragPreview && dragPreview.contributionId === draggingContribution.id && (
            <div
              styleName={
                dragPreview.refusalReason ? 'drag-ghost-tooltip drag-ghost-tooltip-invalid' : 'drag-ghost-tooltip'
              }
            >
              {minutesToLabel(dragPreview.startMinutes)}–
              {minutesToLabel(dragPreview.startMinutes + (draggingContribution.duration_minutes ?? 0))}
              {dragPreview.refusalReason && (
                <span styleName="drag-ghost-reason">{dragPreview.refusalReason}</span>
              )}
            </div>
          )}
        </div>
      )}

      <Confirm
        open={pendingDelete !== null}
        size="mini"
        content={pendingDelete?.message}
        cancelButton={Translate.string('Cancel')}
        confirmButton={Translate.string('Delete')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          pendingDelete?.run();
          setPendingDelete(null);
        }}
        mountNode={mountNode}
      />
    </div>
  );
}
