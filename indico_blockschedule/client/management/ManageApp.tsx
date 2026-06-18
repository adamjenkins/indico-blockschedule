// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import columnsCreateURL from 'indico-url:plugin_blockschedule.columns_create';
import columnsUpdateURL from 'indico-url:plugin_blockschedule.columns_delete_update';
import gridDataURL from 'indico-url:plugin_blockschedule.manage_grid_data';
import scheduleURL from 'indico-url:plugin_blockschedule.schedule';
import unscheduleURL from 'indico-url:plugin_blockschedule.unschedule';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Dropdown, Loader} from 'semantic-ui-react';

import {indicoAxios, handleAxiosError} from 'indico/utils/axios';

import {FullscreenButton} from '../FullscreenButton';
import {BSGridData} from '../types';

import {ScheduleGrid} from './ScheduleGrid';
import {UnscheduledPanel} from './UnscheduledPanel';

import './ManageApp.module.scss';

interface ManageAppProps {
  eventId: number;
}

export function ManageApp({eventId}: ManageAppProps) {
  const [gridData, setGridData] = useState<BSGridData | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(
    async (targetDay?: string) => {
      try {
        const {data} = await indicoAxios.get(gridDataURL({event_id: eventId}), {
          params: targetDay ? {day: targetDay} : {},
        });
        setGridData(data);
        setDay(data.day);
      } catch (error) {
        handleAxiosError(error);
      }
    },
    [eventId]
  );

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleContribution = async (contributionId: number, columnId: number, startMinutes: number) => {
    try {
      await indicoAxios.post(scheduleURL({event_id: eventId}), {
        contribution_id: contributionId,
        column_id: columnId,
        day,
        start_minutes: startMinutes,
      });
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const unscheduleContribution = async (contributionId: number) => {
    try {
      await indicoAxios.post(unscheduleURL({event_id: eventId}), {contribution_id: contributionId});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const createColumn = async (roomId: number | null, label: string) => {
    try {
      await indicoAxios.post(columnsCreateURL({event_id: eventId}), {room_id: roomId, label});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const updateColumnLabel = async (columnId: number, label: string) => {
    try {
      await indicoAxios.patch(columnsUpdateURL({event_id: eventId, column_id: columnId}), {label});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const deleteColumn = async (columnId: number) => {
    try {
      await indicoAxios.delete(columnsUpdateURL({event_id: eventId, column_id: columnId}));
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  if (!gridData) {
    return <Loader active size="massive" inline="centered" />;
  }

  return (
    <div styleName="manage-app" ref={containerRef}>
      <div styleName="toolbar">
        {gridData.event_days.length > 1 && (
          <Dropdown
            selection
            value={gridData.day}
            options={gridData.event_days.map(d => ({key: d, value: d, text: d}))}
            onChange={(_e, {value}) => reload(value as string)}
          />
        )}
        <FullscreenButton targetRef={containerRef} />
      </div>
      <div styleName="layout">
        <UnscheduledPanel
          eventId={eventId}
          contributions={gridData.unscheduled_contributions}
          onUnschedule={unscheduleContribution}
        />
        <ScheduleGrid
          eventId={eventId}
          gridData={gridData}
          onSchedule={scheduleContribution}
          onUnschedule={unscheduleContribution}
          onCreateColumn={createColumn}
          onUpdateColumnLabel={updateColumnLabel}
          onDeleteColumn={deleteColumn}
        />
      </div>
    </div>
  );
}

customElements.define(
  'ind-blockschedule-manage',
  class extends HTMLElement {
    connectedCallback() {
      const eventId = JSON.parse(this.getAttribute('event-id') ?? '0');
      ReactDOM.render(<ManageApp eventId={eventId} />, this);
    }
  }
);
