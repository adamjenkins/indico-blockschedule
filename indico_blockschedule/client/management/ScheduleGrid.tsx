// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useState} from 'react';
import {Button, Dropdown, Icon, Input} from 'semantic-ui-react';

import {Translate} from 'indico/react/i18n';

import {paleBackground, readableTextColor} from '../colors';
import {ContributionBlock} from '../ContributionBlock';
import {buildSlots, durationToPx, GUTTER_PX, minutesToLabel, minutesToOffsetPx, SLOT_PX} from '../gridTime';
import {BSGridData} from '../types';

import './ScheduleGrid.module.scss';

const COLUMN_DRAG_TYPE = 'application/x-bs-column';
const SPANNING_DRAG_TYPE = 'application/x-bs-spanning';

interface UpdateColumnData {
  label?: string;
  color?: string | null;
}

interface UpdateSpanningBlockData {
  title?: string;
  start_minutes?: number;
  duration_minutes?: number;
  color?: string;
}

interface ScheduleGridProps {
  eventId: number;
  gridData: BSGridData;
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
        top: minutesToOffsetPx(block.start_minutes, gridData.day_start_time, gridData.slot_minutes),
        height: durationToPx(block.duration_minutes, gridData.slot_minutes),
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

export function ScheduleGrid({
  eventId,
  gridData,
  onSchedule,
  onUnschedule,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onReorderColumns,
  onCreateSpanningBlock,
  onUpdateSpanningBlock,
  onDeleteSpanningBlock,
}: ScheduleGridProps) {
  const slots = buildSlots(gridData.day_start_time, gridData.day_end_time, gridData.slot_minutes);
  const bodyHeight = slots.length * SLOT_PX;
  const contributionsById = new Map(
    [...gridData.scheduled_contributions, ...gridData.unscheduled_contributions].map(c => [c.id, c])
  );

  const onCellDrop = (event: React.DragEvent, columnId: number, slotMinutes: number) => {
    event.preventDefault();
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
    const startMinutes = contribution
      ? snapStart(slotMinutes, contribution.duration_minutes ?? 0, columnId, contributionId, gridData)
      : slotMinutes;
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
      <div styleName="header-row">
        <div styleName="corner" style={{width: GUTTER_PX}} />
        {gridData.columns.map(column => (
          <div key={column.id} styleName="header-cell">
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
            <div key={slotMinutes} styleName="time-label" style={{height: SLOT_PX}}>
              {minutesToLabel(slotMinutes)}
            </div>
          ))}
        </div>

        {gridData.columns.map(column => (
          <div
            key={column.id}
            styleName="column-track"
            style={{height: bodyHeight, backgroundColor: column.color ? paleBackground(`#${column.color}`) : undefined}}
          >
            {slots.map(slotMinutes => (
              <div
                key={slotMinutes}
                styleName="cell"
                style={{height: SLOT_PX}}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onCellDrop(e, column.id, slotMinutes)}
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
                                          gridData.slot_minutes),
                    height: durationToPx(contribution.duration_minutes, gridData.slot_minutes),
                  }}
                >
                  <ContributionBlock
                    contribution={contribution}
                    eventId={eventId}
                    draggable
                    onDragStart={(e, c) => e.dataTransfer.setData('text/plain', String(c.id))}
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

      <AddColumnForm
        roombookingEnabled={gridData.roombooking_enabled}
        rooms={gridData.rooms}
        onCreateColumn={onCreateColumn}
      />
      <AddSpanningBlockForm slots={slots} onCreateSpanningBlock={onCreateSpanningBlock} />
    </div>
  );
}
