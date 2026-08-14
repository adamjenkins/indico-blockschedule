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
import sessionBlocksCreateURL from 'indico-url:plugin_blockschedule.session_blocks_create';
import sessionBlocksUpdateURL from 'indico-url:plugin_blockschedule.session_blocks_delete_update';
import settingsUpdateURL from 'indico-url:plugin_blockschedule.settings_update';
import spanningBlocksCreateURL from 'indico-url:plugin_blockschedule.spanning_blocks_create';
import spanningBlocksUpdateURL from 'indico-url:plugin_blockschedule.spanning_blocks_delete_update';
import unscheduleURL from 'indico-url:plugin_blockschedule.unschedule';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Checkbox, Dropdown, Loader} from 'semantic-ui-react';

import {FullscreenButton} from '../FullscreenButton';
import {BSDescriptionDisplay, BSGridData} from '../types';

import {AutoscheduleForm} from './AutoscheduleForm';
import {ExportButton} from './ExportButton';
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

  const updateColumn = async (
    columnId: number,
    data: {label?: string; color?: string | null; min_width_px?: number}
  ) => {
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

  const updateSettings = async (data: {
    gap_minutes?: number;
    snap_minutes?: number;
    row_height_px?: number;
    show_session_track?: boolean;
    description_display?: BSDescriptionDisplay;
  }) => {
    try {
      await indicoAxios.patch(settingsUpdateURL({event_id: eventId}), data);
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const runAutoschedule = async (
    startDay: string,
    startMinutes: number,
    endDay: string,
    endMinutes: number,
    clear: boolean,
    excludeSessionIds: number[],
    excludeTrackIds: number[]
  ) => {
    try {
      const {data} = await indicoAxios.post(autoscheduleURL({event_id: eventId}), {
        start_day: startDay,
        start_minutes: startMinutes,
        end_day: endDay,
        end_minutes: endMinutes,
        clear,
        exclude_session_ids: excludeSessionIds,
        exclude_track_ids: excludeTrackIds,
      });
      await reload(day ?? undefined);
      return data as {cleared: boolean; unscheduled_count: number; unscheduled_titles: string[]};
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

  const createSessionBlock = async (data: {
    session_id: number | null;
    title: string | null;
    start_minutes: number;
    duration_minutes: number;
    color: string | null;
    column_ids: number[] | null;
  }) => {
    try {
      await indicoAxios.post(sessionBlocksCreateURL({event_id: eventId}), {day, ...data});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const updateSessionBlock = async (
    blockId: number,
    data: {start_minutes?: number; duration_minutes?: number; color?: string; column_ids?: number[] | null}
  ) => {
    try {
      await indicoAxios.patch(sessionBlocksUpdateURL({event_id: eventId, block_id: blockId}), {day, ...data});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const deleteSessionBlock = async (blockId: number) => {
    try {
      await indicoAxios.delete(sessionBlocksUpdateURL({event_id: eventId, block_id: blockId}));
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
                updateSettings({gap_minutes: value});
              }
            }}
          />
        </label>
        <label styleName="gap-setting">
          <Translate>Snap to (min, 0 = off)</Translate>
          <input
            type="number"
            min={0}
            defaultValue={gridData.snap_minutes}
            key={gridData.snap_minutes}
            onBlur={e => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value !== gridData.snap_minutes) {
                updateSettings({snap_minutes: value});
              }
            }}
          />
        </label>
        <label styleName="gap-setting">
          <Translate>Row height (px)</Translate>
          <input
            type="number"
            min={20}
            step={5}
            defaultValue={gridData.row_height_px}
            key={gridData.row_height_px}
            onBlur={e => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value !== gridData.row_height_px) {
                updateSettings({row_height_px: value});
              }
            }}
          />
        </label>
        <Checkbox
          toggle
          label={Translate.string('Show session/track')}
          checked={gridData.show_session_track}
          onChange={(_e, {checked}) => updateSettings({show_session_track: !!checked})}
        />
        <label styleName="gap-setting">
          <Translate>Description</Translate>
          <select
            value={gridData.description_display}
            onChange={e => updateSettings({description_display: e.target.value as BSDescriptionDisplay})}
          >
            <option value="hidden">{Translate.string('Hidden')}</option>
            <option value="truncated">{Translate.string('Truncated')}</option>
            <option value="full">{Translate.string('Full')}</option>
          </select>
        </label>
        <AutoscheduleForm
          eventDays={gridData.event_days}
          currentDay={gridData.day}
          sessions={gridData.sessions}
          tracks={gridData.tracks}
          onRun={runAutoschedule}
        />
        <ExportButton eventId={eventId} day={gridData.day} />
        <FullscreenButton targetRef={containerRef} />
      </div>
      <div styleName="layout">
        <UnscheduledPanel
          contributions={gridData.unscheduled_contributions}
          showSessionTrack={gridData.show_session_track}
          onUnschedule={unscheduleContribution}
        />
        <ScheduleGrid
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
          onCreateSessionBlock={createSessionBlock}
          onUpdateSessionBlock={updateSessionBlock}
          onDeleteSessionBlock={deleteSessionBlock}
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
