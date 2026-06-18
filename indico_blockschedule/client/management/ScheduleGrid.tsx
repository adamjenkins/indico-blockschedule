// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useState} from 'react';
import {Button, Dropdown, Icon, Input} from 'semantic-ui-react';

import {Translate} from 'indico/react/i18n';

import {ContributionBlock} from '../ContributionBlock';
import {buildSlots, durationToPx, GUTTER_PX, minutesToLabel, minutesToOffsetPx, SLOT_PX} from '../gridTime';
import {BSGridData} from '../types';

import './ScheduleGrid.module.scss';

interface ScheduleGridProps {
  eventId: number;
  gridData: BSGridData;
  onSchedule: (contributionId: number, columnId: number, startMinutes: number) => void;
  onUnschedule: (contributionId: number) => void;
  onCreateColumn: (roomId: number | null, label: string) => void;
  onUpdateColumnLabel: (columnId: number, label: string) => void;
  onDeleteColumn: (columnId: number) => void;
}

function ColumnHeader({
  column,
  onUpdateLabel,
  onDelete,
}: {
  column: BSGridData['columns'][number];
  onUpdateLabel: (label: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.title);

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
            onUpdateLabel(value.trim());
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
    <div styleName="column-header" onClick={() => setEditing(true)}>
      <span>{column.title}</span>
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
  onCreateColumn: (roomId: number | null, label: string) => void;
}) {
  const [roomId, setRoomId] = useState<number | null>(null);
  const [label, setLabel] = useState('');

  const submit = () => {
    if (!label.trim()) {
      return;
    }
    onCreateColumn(roomId, label.trim());
    setRoomId(null);
    setLabel('');
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
      <Button primary disabled={!label.trim()} onClick={submit}>
        <Translate>Add column</Translate>
      </Button>
    </div>
  );
}

export function ScheduleGrid({
  eventId,
  gridData,
  onSchedule,
  onUnschedule,
  onCreateColumn,
  onUpdateColumnLabel,
  onDeleteColumn,
}: ScheduleGridProps) {
  const slots = buildSlots(gridData.day_start_time, gridData.day_end_time, gridData.slot_minutes);
  const bodyHeight = slots.length * SLOT_PX;

  const onDrop = (event: React.DragEvent, columnId: number, slotMinutes: number) => {
    event.preventDefault();
    const contributionId = Number(event.dataTransfer.getData('text/plain'));
    if (contributionId) {
      onSchedule(contributionId, columnId, slotMinutes);
    }
  };

  return (
    <div styleName="grid-wrapper">
      <div styleName="header-row">
        <div styleName="corner" style={{width: GUTTER_PX}} />
        {gridData.columns.map(column => (
          <div key={column.id} styleName="header-cell">
            <ColumnHeader
              column={column}
              onUpdateLabel={label => onUpdateColumnLabel(column.id, label)}
              onDelete={() => onDeleteColumn(column.id)}
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
          <div key={column.id} styleName="column-track" style={{height: bodyHeight}}>
            {slots.map(slotMinutes => (
              <div
                key={slotMinutes}
                styleName="cell"
                style={{height: SLOT_PX}}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onDrop(e, column.id, slotMinutes)}
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
      </div>

      <AddColumnForm
        roombookingEnabled={gridData.roombooking_enabled}
        rooms={gridData.rooms}
        onCreateColumn={onCreateColumn}
      />
    </div>
  );
}
