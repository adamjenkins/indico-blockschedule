// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import gridDataURL from 'indico-url:plugin_blockschedule.display_grid_data';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';
import React, {useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Checkbox, Dropdown, Loader} from 'semantic-ui-react';

import {paleBackground, readableTextColor, trackColorMap} from '../colors';
import {ContributionBlock} from '../ContributionBlock';
import {FilterBar} from '../FilterBar';
import {applyFilters, BSFilters, parseFilters, syncFiltersToUrl} from '../filters';
import {FullscreenButton} from '../FullscreenButton';
import {buildSlots, durationToPx, GUTTER_PX, minutesToLabel, minutesToOffsetPx} from '../gridTime';
import {BSGridData} from '../types';

import {ExportButton} from './ExportButton';
import {PrintButton} from './PrintButton';
import {StickyScrollbar} from './StickyScrollbar';

import './DisplayApp.module.scss';

interface DisplayAppProps {
  eventId: number;
  loggedIn: boolean;
}

export function DisplayApp({eventId, loggedIn}: DisplayAppProps) {
  const [gridData, setGridData] = useState<BSGridData | null>(null);
  const [highlightStarred, setHighlightStarred] = useState(false);
  const [blackAndWhite, setBlackAndWhite] = useState(false);
  // Seeded from the URL so a shared/bookmarked filtered view opens filtered.
  const [filters, setFilters] = useState<BSFilters>(() => parseFilters(window.location.search));
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async (day?: string) => {
    try {
      const {data} = await indicoAxios.get(gridDataURL({event_id: eventId}), {params: day ? {day} : {}});
      setGridData(data);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  useEffect(() => {
    // The URL's `day` is part of the shared view too: without it, a link meaning
    // "Wednesday's 9th floor" would open on the default day with only the floor restored.
    load(filters.day ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the day in the query string alongside the filters. The server decides the actual
  // day (an unknown one falls back to the default), so the URL follows what really loaded.
  useEffect(() => {
    if (gridData && filters.day !== gridData.day) {
      const next = {...filters, day: gridData.day};
      setFilters(next);
      syncFiltersToUrl(next);
    }
  }, [gridData, filters]);

  if (!gridData) {
    return <Loader active size="massive" inline="centered" />;
  }

  const {columns, isDimmed} = applyFilters(gridData, filters);
  const updateFilters = (next: BSFilters) => {
    setFilters(next);
    syncFiltersToUrl(next);
  };

  const slots = buildSlots(gridData.day_start_time, gridData.day_end_time, gridData.slot_minutes);
  const rowHeightPx = gridData.row_height_px;
  const trackColors = trackColorMap(gridData.tracks);
  const bodyHeight = slots.length * rowHeightPx;

  // What the active filter means in words, for the printed header -- the room names are on
  // the sheet already, but "which slice of the event is this" is not, and a stack of
  // filtered prints is indistinguishable without it.
  const printFilterParts: string[] = [];
  const roomNames = [
    ...gridData.groups.filter(g => filters.groupIds.includes(g.id)).map(g => g.title),
    ...gridData.columns.filter(c => filters.roomIds.includes(c.id)).map(c => c.title),
  ];
  if (roomNames.length) {
    printFilterParts.push(Translate.string('Rooms: {names}', {names: roomNames.join(', ')}));
  }
  const trackNames = gridData.tracks.filter(t => filters.trackIds.includes(t.id)).map(t => t.title);
  if (trackNames.length) {
    printFilterParts.push(Translate.string('Tracks: {names}', {names: trackNames.join(', ')}));
  }
  const printFilterDescription = printFilterParts.length ? printFilterParts.join(' — ') : null;

  return (
    <div styleName={blackAndWhite ? 'display-app bs-bw' : 'display-app'} ref={containerRef}>
      <div styleName="toolbar">
        {gridData.event_days.length > 1 && (
          <Dropdown
            selection
            value={gridData.day}
            options={gridData.event_days.map(d => ({key: d, value: d, text: d}))}
            onChange={(_e, {value}) => load(value as string)}
          />
        )}
        {loggedIn && (
          <Checkbox
            toggle
            label={Translate.string('Highlight my timetable')}
            checked={highlightStarred}
            onChange={(_e, {checked}) => setHighlightStarred(!!checked)}
          />
        )}
        <Checkbox
          toggle
          label={Translate.string('Black and white')}
          checked={blackAndWhite}
          onChange={(_e, {checked}) => setBlackAndWhite(!!checked)}
        />
        <FilterBar
          columns={gridData.columns}
          groups={gridData.groups}
          tracks={gridData.tracks}
          filters={filters}
          onChange={updateFilters}
          visibleCount={columns.length}
        />
        <ExportButton eventId={eventId} day={gridData.day} />
        <PrintButton
          containerRef={containerRef}
          eventTitle={gridData.event_title}
          day={gridData.day}
          filterDescription={printFilterDescription}
        />
        <FullscreenButton targetRef={containerRef} />
      </div>

      <div styleName="header-row">
        <div styleName="corner" style={{width: GUTTER_PX}} />
        {columns.map(column => (
          <div
            key={column.id}
            styleName="header-cell"
            style={{
              minWidth: column.min_width_px || undefined,
              ...(column.color
                ? {backgroundColor: `#${column.color}`, color: readableTextColor(`#${column.color}`)}
                : undefined),
            }}
          >
            {column.title}
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

        {columns.map(column => (
          <div
            key={column.id}
            styleName="column-track"
            style={{
              height: bodyHeight,
              minWidth: column.min_width_px || undefined,
              backgroundColor: column.color ? paleBackground(`#${column.color}`) : undefined,
            }}
          >
            {slots.map(slotMinutes => (
              <div key={slotMinutes} styleName="cell" style={{height: rowHeightPx}} />
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
                    href={contribution.url}
                    highlightStarred={highlightStarred}
                    showFavorite={loggedIn}
                    dimmed={isDimmed(contribution)}
                    showSessionTrack={gridData.show_session_track}
                    trackColor={
                      contribution.track_id === null ? null : trackColors.get(contribution.track_id)
                    }
                    titleMaxLines={gridData.title_max_lines}
                    style={{height: '100%'}}
                  />
                </div>
              ))}
            {gridData.session_blocks
              .filter(block => block.column_ids === null || block.column_ids.includes(column.id))
              .map(block => {
                const spannedIds = block.column_ids ?? gridData.columns.map(c => c.id);
                const firstSpannedColumn = columns.find(c => spannedIds.includes(c.id));
                return (
                  <div
                    key={block.id}
                    styleName="session-block"
                    style={{
                      top: minutesToOffsetPx(block.start_minutes, gridData.day_start_time, gridData.slot_minutes,
                                            rowHeightPx),
                      height: durationToPx(block.duration_minutes, gridData.slot_minutes, rowHeightPx),
                      backgroundColor: block.color ? `#${block.color}` : '#e3f2d3',
                      color: readableTextColor(block.color ? `#${block.color}` : '#e3f2d3'),
                    }}
                  >
                    {firstSpannedColumn?.id === column.id && block.title}
                  </div>
                );
              })}
          </div>
        ))}

        {gridData.spanning_blocks.map(block => (
          <div
            key={block.id}
            styleName="spanning-block"
            style={{
              top: minutesToOffsetPx(block.start_minutes, gridData.day_start_time, gridData.slot_minutes,
                                    rowHeightPx),
              height: durationToPx(block.duration_minutes, gridData.slot_minutes, rowHeightPx),
              left: GUTTER_PX,
              backgroundColor: block.color ? `#${block.color}` : undefined,
              color: block.color ? readableTextColor(`#${block.color}`) : undefined,
            }}
          >
            {block.title}
          </div>
        ))}
      </div>

      {/* The grid's own horizontal scrollbar sits at the bottom of a table that is usually
          several screens tall, so it is off-screen whenever it is wanted. This mirrors it at
          the bottom of the window. */}
      <StickyScrollbar targetRef={containerRef} revision={`${gridData.day}|${columns.length}`} />
    </div>
  );
}

customElements.define(
  'ind-blockschedule-display',
  class extends HTMLElement {
    connectedCallback() {
      const eventId = JSON.parse(this.getAttribute('event-id') ?? '0');
      const loggedIn = JSON.parse(this.getAttribute('logged-in') ?? 'false');
      ReactDOM.render(<DisplayApp eventId={eventId} loggedIn={loggedIn} />, this);
    }
  }
);
