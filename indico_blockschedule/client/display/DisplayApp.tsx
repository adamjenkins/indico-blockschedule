// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import gridDataURL from 'indico-url:plugin_blockschedule.display_grid_data';

import React, {useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Checkbox, Dropdown, Loader} from 'semantic-ui-react';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';

import {ContributionBlock} from '../ContributionBlock';
import {FullscreenButton} from '../FullscreenButton';
import {buildSlots, durationToPx, GUTTER_PX, minutesToLabel, minutesToOffsetPx} from '../gridTime';
import {BSGridData} from '../types';

import {ExportButton} from './ExportButton';
import {PrintButton} from './PrintButton';

import './DisplayApp.module.scss';

// Duplicated from '../colors' rather than imported: sharing that module with the
// management entry would put it (and whatever else ends up alongside it) into a
// webpack-generated "common" chunk, which breaks at runtime here since plugin
// builds disable a shared runtime chunk (see webpack/base.mjs's `runtimeChunk`).
function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function paleBackground(hex: string, amount = 0.85): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function readableTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#202020' : '#ffffff';
}

interface DisplayAppProps {
  eventId: number;
  loggedIn: boolean;
}

export function DisplayApp({eventId, loggedIn}: DisplayAppProps) {
  const [gridData, setGridData] = useState<BSGridData | null>(null);
  const [highlightStarred, setHighlightStarred] = useState(false);
  const [blackAndWhite, setBlackAndWhite] = useState(false);
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!gridData) {
    return <Loader active size="massive" inline="centered" />;
  }

  const slots = buildSlots(gridData.day_start_time, gridData.day_end_time, gridData.slot_minutes);
  const rowHeightPx = gridData.row_height_px;
  const bodyHeight = slots.length * rowHeightPx;

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
        <ExportButton eventId={eventId} day={gridData.day} />
        <PrintButton containerRef={containerRef} eventTitle={gridData.event_title} />
        <FullscreenButton targetRef={containerRef} />
      </div>

      <div styleName="header-row">
        <div style={{width: GUTTER_PX}} />
        {gridData.columns.map(column => (
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

        {gridData.columns.map(column => (
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
                    showSessionTrack={gridData.show_session_track}
                    style={{height: '100%'}}
                  />
                </div>
              ))}
            {gridData.session_blocks
              .filter(block => block.column_ids === null || block.column_ids.includes(column.id))
              .map(block => {
                const spannedIds = block.column_ids ?? gridData.columns.map(c => c.id);
                const firstSpannedColumn = gridData.columns.find(c => spannedIds.includes(c.id));
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
