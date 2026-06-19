// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import autoscheduleURL from 'indico-url:plugin_blockschedule.autoschedule';
import columnsCreateURL from 'indico-url:plugin_blockschedule.columns_create';
import columnsUpdateURL from 'indico-url:plugin_blockschedule.columns_delete_update';
import columnsReorderURL from 'indico-url:plugin_blockschedule.columns_reorder';
import gridDataURL from 'indico-url:plugin_blockschedule.manage_grid_data';
import scheduleURL from 'indico-url:plugin_blockschedule.schedule';
import settingsUpdateURL from 'indico-url:plugin_blockschedule.settings_update';
import spanningBlocksCreateURL from 'indico-url:plugin_blockschedule.spanning_blocks_create';
import spanningBlocksUpdateURL from 'indico-url:plugin_blockschedule.spanning_blocks_delete_update';
import unscheduleURL from 'indico-url:plugin_blockschedule.unschedule';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Dropdown, Loader} from 'semantic-ui-react';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';

import {FullscreenButton} from '../FullscreenButton';
import {BSGridData} from '../types';

import {AutoscheduleForm} from './AutoscheduleForm';
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

  const createColumn = async (roomId: number | null, label: string, color: string | null) => {
    try {
      await indicoAxios.post(columnsCreateURL({event_id: eventId}), {room_id: roomId, label, color});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const updateColumn = async (columnId: number, data: {label?: string; color?: string | null}) => {
    try {
      await indicoAxios.patch(columnsUpdateURL({event_id: eventId, column_id: columnId}), data);
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

  const reorderColumns = async (columnIds: number[]) => {
    try {
      await indicoAxios.post(columnsReorderURL({event_id: eventId}), {column_ids: columnIds});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const updateGapMinutes = async (gapMinutes: number) => {
    try {
      await indicoAxios.patch(settingsUpdateURL({event_id: eventId}), {gap_minutes: gapMinutes});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const runAutoschedule = async (
    startDay: string,
    startMinutes: number,
    endDay: string,
    endMinutes: number
  ) => {
    try {
      const {data} = await indicoAxios.post(autoscheduleURL({event_id: eventId}), {
        start_day: startDay,
        start_minutes: startMinutes,
        end_day: endDay,
        end_minutes: endMinutes,
      });
      await reload(day ?? undefined);
      return data as {unscheduled_count: number; unscheduled_titles: string[]};
    } catch (error) {
      handleAxiosError(error);
      return null;
    }
  };

  const createSpanningBlock = async (
    title: string,
    startMinutes: number,
    durationMinutes: number,
    color: string | null
  ) => {
    try {
      await indicoAxios.post(spanningBlocksCreateURL({event_id: eventId}), {
        title,
        day,
        start_minutes: startMinutes,
        duration_minutes: durationMinutes,
        color,
      });
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const updateSpanningBlock = async (
    entryId: number,
    data: {title?: string; start_minutes?: number; duration_minutes?: number; color?: string}
  ) => {
    try {
      await indicoAxios.patch(spanningBlocksUpdateURL({event_id: eventId, entry_id: entryId}), {day, ...data});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const deleteSpanningBlock = async (entryId: number) => {
    try {
      await indicoAxios.delete(spanningBlocksUpdateURL({event_id: eventId, entry_id: entryId}));
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
        <label styleName="gap-setting">
          <Translate>Gap after contributions (min)</Translate>
          <input
            type="number"
            min={0}
            defaultValue={gridData.gap_minutes}
            key={gridData.gap_minutes}
            onBlur={e => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value !== gridData.gap_minutes) {
                updateGapMinutes(value);
              }
            }}
          />
        </label>
        <AutoscheduleForm eventDays={gridData.event_days} currentDay={gridData.day} onRun={runAutoschedule} />
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
          onUpdateColumn={updateColumn}
          onDeleteColumn={deleteColumn}
          onReorderColumns={reorderColumns}
          onCreateSpanningBlock={createSpanningBlock}
          onUpdateSpanningBlock={updateSpanningBlock}
          onDeleteSpanningBlock={deleteSpanningBlock}
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
