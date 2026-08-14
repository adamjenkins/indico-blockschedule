// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import {Translate} from 'indico/react/i18n';
import React from 'react';
import {Button, Dropdown} from 'semantic-ui-react';

import {BSFilters, EMPTY_FILTERS, hasActiveFilters} from './filters';
import {BSColumn, BSGroup, BSTrack} from './types';

import './FilterBar.module.scss';

interface FilterBarProps {
  columns: BSColumn[];
  groups: BSGroup[];
  tracks: BSTrack[];
  filters: BSFilters;
  onChange: (filters: BSFilters) => void;
  /** How many columns survive the current filter, for the summary. */
  visibleCount: number;
}

export function FilterBar({columns, groups, tracks, filters, onChange, visibleCount}: FilterBarProps) {
  // Groups and individual rooms share one dropdown: people think "show me the
  // 9th floor and the main hall", not "pick a mode, then pick items".
  const roomOptions = [
    ...groups.map(group => ({
      key: `g${group.id}`,
      value: `g${group.id}`,
      text: group.title,
      description: Translate.string('{count} rooms', {count: group.column_ids.length}),
      icon: 'th',
    })),
    ...columns.map(column => ({
      key: `c${column.id}`,
      value: `c${column.id}`,
      text: column.title,
      icon: 'square outline',
    })),
  ];
  const roomValue = [
    ...filters.groupIds.map(id => `g${id}`),
    ...filters.roomIds.map(id => `c${id}`),
  ];

  const onRoomChange = (value: string[]) => {
    onChange({
      ...filters,
      groupIds: value.filter(v => v.startsWith('g')).map(v => parseInt(v.slice(1), 10)),
      roomIds: value.filter(v => v.startsWith('c')).map(v => parseInt(v.slice(1), 10)),
    });
  };

  const active = hasActiveFilters(filters);

  return (
    <div styleName="filter-bar">
      <Dropdown
        selection
        multiple
        search
        clearable
        styleName="filter-dropdown"
        placeholder={Translate.string('All rooms')}
        options={roomOptions}
        value={roomValue}
        onChange={(_e, {value}) => onRoomChange(value as string[])}
      />
      {tracks.length > 0 && (
        <Dropdown
          selection
          multiple
          search
          clearable
          styleName="filter-dropdown"
          placeholder={Translate.string('All tracks')}
          options={tracks.map(track => ({key: track.id, value: track.id, text: track.title}))}
          value={filters.trackIds}
          onChange={(_e, {value}) => onChange({...filters, trackIds: value as number[]})}
        />
      )}
      {active && (
        <>
          <span styleName="summary">
            {Translate.string('Showing {visible} of {total} rooms', {
              visible: visibleCount,
              total: columns.length,
            })}
          </span>
          <Button
            size="tiny"
            basic
            icon="undo"
            content={Translate.string('Clear')}
            onClick={() => onChange(EMPTY_FILTERS)}
          />
        </>
      )}
    </div>
  );
}
