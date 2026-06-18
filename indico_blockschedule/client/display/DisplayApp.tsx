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
import {buildSlots, durationToPx, GUTTER_PX, minutesToLabel, minutesToOffsetPx, SLOT_PX} from '../gridTime';
import {BSGridData} from '../types';

import './DisplayApp.module.scss';

interface DisplayAppProps {
  eventId: number;
  loggedIn: boolean;
}

export function DisplayApp({eventId, loggedIn}: DisplayAppProps) {
  const [gridData, setGridData] = useState<BSGridData | null>(null);
  const [highlightStarred, setHighlightStarred] = useState(false);
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
  const bodyHeight = slots.length * SLOT_PX;

  return (
    <div styleName="display-app" ref={containerRef}>
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
        <FullscreenButton targetRef={containerRef} />
      </div>

      <div styleName="header-row">
        <div style={{width: GUTTER_PX}} />
        {gridData.columns.map(column => (
          <div key={column.id} styleName="header-cell">
            {column.title}
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
              <div key={slotMinutes} styleName="cell" style={{height: SLOT_PX}} />
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
                    href={contribution.url}
                    dimmed={highlightStarred && !contribution.is_starred}
                    showFavorite={loggedIn}
                    style={{height: '100%'}}
                  />
                </div>
              ))}
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
