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
import trackColorsURL from 'indico-url:plugin_blockschedule.manage_track_colors';
import scheduleURL from 'indico-url:plugin_blockschedule.schedule';
import sessionBlocksCreateURL from 'indico-url:plugin_blockschedule.session_blocks_create';
import sessionBlocksUpdateURL from 'indico-url:plugin_blockschedule.session_blocks_delete_update';
import settingsUpdateURL from 'indico-url:plugin_blockschedule.settings_update';
import spanningBlocksCreateURL from 'indico-url:plugin_blockschedule.spanning_blocks_create';
import spanningBlocksUpdateURL from 'indico-url:plugin_blockschedule.spanning_blocks_delete_update';
import unscheduleURL from 'indico-url:plugin_blockschedule.unschedule';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Checkbox, Dropdown, Loader} from 'semantic-ui-react';

import {trackColorMap} from '../colors';
import {FilterBar} from '../FilterBar';
import {applyFilters, BSFilters, parseFilters, syncFiltersToUrl} from '../filters';
import {FullscreenButton} from '../FullscreenButton';
import {minutesToLabel, parseTimeToMinutes} from '../gridTime';
import {BSContribution, BSDescriptionDisplay, BSGridData} from '../types';
import {useFullscreenMountNode} from '../useFullscreenMountNode';

import {AutoscheduleForm} from './AutoscheduleForm';
import {ContributionDragState, startContributionDrag} from './contributionDrag';
import {ExportButton} from './ExportButton';
import {GroupManager} from './GroupManager';
import {ScheduleGrid} from './ScheduleGrid';
import {UnscheduledPanel} from './UnscheduledPanel';

import './ManageApp.module.scss';

interface ManageAppProps {
  eventId: number;
}

export function ManageApp({eventId}: ManageAppProps) {
  const [gridData, setGridData] = useState<BSGridData | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [filters, setFilters] = useState<BSFilters>(() => parseFilters(window.location.search));
  // The contribution drag in progress, if any. Owned here rather than by the grid because a
  // drag can start in the unscheduled panel just as well, and the grid draws the ghost and
  // live time preview for both.
  const [contributionDrag, setContributionDrag] = useState<ContributionDragState | null>(null);
  // Whether the grid shows the whole day rather than just the working-hours window -- the
  // escape hatch for reaching entries that ended up outside working hours.
  const [fullDay, setFullDay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Semantic UI portals (the autoschedule popup, the room-groups modal, the delete
  // confirmations) must mount inside this container, or going fullscreen leaves them
  // opening invisibly outside the fullscreened subtree.
  const mountNode = useFullscreenMountNode(containerRef);

  const onContributionDragStart = (event: React.DragEvent, contribution: BSContribution) =>
    setContributionDrag(startContributionDrag(event, contribution));
  const onContributionDragEnd = () => setContributionDrag(null);

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
    // Seeded from the URL's `day`, so a shared link opens on the day it was showing.
    reload(filters.day ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the day in the query string alongside the filters: the server decides the actual
  // day (an unknown one falls back to the default), so the URL follows what was really
  // loaded rather than what was asked for.
  useEffect(() => {
    if (day !== null && filters.day !== day) {
      const next = {...filters, day};
      setFilters(next);
      syncFiltersToUrl(next);
    }
  }, [day, filters]);

  /**
   * Put one changed contribution back into the grid without refetching it.
   *
   * The schedule and unschedule endpoints both return the contribution they
   * changed, so there is nothing to go back to the server for. Refetching cost
   * a full grid build per drag -- the single slowest thing a manager waited for
   * -- and this is a drag-and-drop interface, so it happened constantly.
   *
   * Safe here specifically because the management payload is always requested
   * with `full_day`, so its bounds are fixed at midnight to midnight -- and the
   * working-hours window the grid actually renders is derived from state on
   * every render, so it follows a patched contribution on its own. The display
   * grid gets server-computed bounds and could not be patched this way.
   */
  const applyContribution = (contribution: BSContribution) => {
    setGridData(current => {
      if (!current) {
        return current;
      }
      const scheduled = current.scheduled_contributions.filter(c => c.id !== contribution.id);
      const unscheduled = (current.unscheduled_contributions ?? []).filter(
        c => c.id !== contribution.id
      );
      // `column_id` is what decides which of the two lists it belongs in --
      // the same rule the server uses when it builds the payload.
      if (contribution.column_id === null) {
        unscheduled.push(contribution);
      } else {
        scheduled.push(contribution);
      }
      return {...current, scheduled_contributions: scheduled, unscheduled_contributions: unscheduled};
    });
  };

  const scheduleContribution = async (contributionId: number, columnId: number, startMinutes: number) => {
    try {
      const {data} = await indicoAxios.post(scheduleURL({event_id: eventId}), {
        contribution_id: contributionId,
        column_id: columnId,
        day,
        start_minutes: startMinutes,
      });
      applyContribution(data);
    } catch (error) {
      handleAxiosError(error);
      // The optimistic view and the server have diverged; get the truth back.
      await reload(day ?? undefined);
    }
  };

  const unscheduleContribution = async (contributionId: number) => {
    try {
      const {data} = await indicoAxios.post(unscheduleURL({event_id: eventId}),
                                            {contribution_id: contributionId});
      applyContribution(data);
    } catch (error) {
      handleAxiosError(error);
      await reload(day ?? undefined);
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
      const {data: column} = await indicoAxios.patch(
        columnsUpdateURL({event_id: eventId, column_id: columnId}), data);
      // Renames and colour changes are frequent and touch one column; the
      // endpoint hands it back, so there is no reason to rebuild the grid.
      setGridData(current => current && {
        ...current,
        columns: current.columns.map(c => (c.id === column.id ? column : c)),
      });
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
    // `columnIds` covers only the visible columns while a filter is active.
    // Hidden columns keep their slots; the visible ones are re-seated into the
    // slots they already occupied, in their new relative order.
    const fullOrder = gridData ? gridData.columns.map(c => c.id) : columnIds;
    const visible = new Set(columnIds);
    let next = 0;
    const merged = fullOrder.map(id => (visible.has(id) ? columnIds[next++] : id));
    try {
      await indicoAxios.post(columnsReorderURL({event_id: eventId}), {column_ids: merged});
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
    }
  };

  const updateSettings = async (data: {
    day_start_time?: string;
    day_end_time?: string;
    slot_minutes?: number;
    gap_minutes?: number;
    snap_minutes?: number;
    row_height_px?: number;
    show_session_track?: boolean;
    description_display?: BSDescriptionDisplay;
    title_max_lines?: number;
  }) => {
    try {
      await indicoAxios.patch(settingsUpdateURL({event_id: eventId}), data);
      await reload(day ?? undefined);
    } catch (error) {
      handleAxiosError(error);
      // A rejected value (e.g. an inverted working-hours pair) leaves the input showing what
      // was typed; refetching resets it to the value the server actually kept.
      await reload(day ?? undefined);
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

  // What the grid renders: the working-hours window plus one slot either side, not the
  // midnight-to-midnight payload the server sends -- at the defaults that is 48 rows of
  // which only 18 accept drops, and every session began with a half-screen scroll past dead
  // rows. The window widens to cover anything placed outside working hours (it must stay
  // visible and reachable), and the "Full day" toolbar toggle restores the whole day.
  const windowedGridData = useMemo(() => {
    if (!gridData || fullDay) {
      return gridData;
    }
    const slot = gridData.slot_minutes;
    let start = parseTimeToMinutes(gridData.working_hours_start) - slot;
    let end = parseTimeToMinutes(gridData.working_hours_end) + slot;
    const placed = [
      ...gridData.scheduled_contributions.filter(c => c.column_id !== null && c.start_minutes !== null),
      ...gridData.spanning_blocks,
      ...gridData.session_blocks,
    ];
    for (const entry of placed) {
      const entryStart = entry.start_minutes as number;
      start = Math.min(start, entryStart);
      end = Math.max(end, entryStart + (entry.duration_minutes ?? 0));
    }
    start = Math.max(0, Math.floor(start / slot) * slot);
    end = Math.min(24 * 60, Math.ceil(end / slot) * slot);
    return {...gridData, day_start_time: minutesToLabel(start), day_end_time: minutesToLabel(end)};
  }, [gridData, fullDay]);

  if (!gridData) {
    return <Loader active size="massive" inline="centered" />;
  }

  // The same filtering the display page uses, so what you arrange here is what
  // prints there: rooms narrowed to the chosen groups/rooms, and talks outside
  // the chosen tracks greyed out rather than removed.
  const {columns: visibleColumns, isDimmed} = applyFilters(gridData, filters);
  const shownGridData = windowedGridData ?? gridData;

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
        {/* The working-hours window and the slot size are the rules the grid enforces on
            every drop, so they are edited right here beside the other grid settings -- an
            out-of-range pair (start after end) comes back as a 400 whose message
            `handleAxiosError` shows, and the reload snaps the input back. */}
        <label styleName="gap-setting">
          <Translate>Day starts</Translate>
          <input
            type="time"
            defaultValue={gridData.working_hours_start}
            key={gridData.working_hours_start}
            onBlur={e => {
              if (e.target.value && e.target.value !== gridData.working_hours_start) {
                updateSettings({day_start_time: e.target.value});
              }
            }}
          />
        </label>
        <label styleName="gap-setting">
          <Translate>Day ends</Translate>
          <input
            type="time"
            defaultValue={gridData.working_hours_end}
            key={gridData.working_hours_end}
            onBlur={e => {
              if (e.target.value && e.target.value !== gridData.working_hours_end) {
                updateSettings({day_end_time: e.target.value});
              }
            }}
          />
        </label>
        <label styleName="gap-setting">
          <Translate>Slot (min)</Translate>
          <input
            type="number"
            min={5}
            max={120}
            step={5}
            defaultValue={gridData.slot_minutes}
            key={gridData.slot_minutes}
            onBlur={e => {
              const value = Number(e.target.value);
              if (e.target.value !== '' && !Number.isNaN(value) && value !== gridData.slot_minutes) {
                updateSettings({slot_minutes: value});
              }
            }}
          />
        </label>
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
        <label styleName="gap-setting">
          <Translate>Title lines (0 = no limit)</Translate>
          <input
            type="number"
            min={0}
            max={20}
            title={Translate.string('Truncate contribution titles after this many lines, here and on the display page')}
            defaultValue={gridData.title_max_lines}
            key={gridData.title_max_lines}
            onBlur={e => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value !== gridData.title_max_lines) {
                updateSettings({title_max_lines: value});
              }
            }}
          />
        </label>
        <Checkbox
          toggle
          label={Translate.string('Full day')}
          title={Translate.string(
            'Show the whole day instead of the working-hours window, e.g. to reach entries scheduled outside it'
          )}
          checked={fullDay}
          onChange={(_e, {checked}) => setFullDay(!!checked)}
        />
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
        <GroupManager
          eventId={eventId}
          columns={gridData.columns}
          groups={gridData.groups}
          mountNode={mountNode}
          onChanged={() => reload(day ?? undefined)}
        />
        <FilterBar
          columns={gridData.columns}
          groups={gridData.groups}
          tracks={gridData.tracks}
          filters={filters}
          onChange={next => {
            setFilters(next);
            syncFiltersToUrl(next);
          }}
          visibleCount={visibleColumns.length}
        />
        <AutoscheduleForm
          // Remount when the working-hours settings change, so the form's
          // seeded default times track the window the grid enforces.
          key={`${gridData.working_hours_start}-${gridData.working_hours_end}`}
          eventDays={gridData.event_days}
          currentDay={gridData.day}
          workingHoursStart={gridData.working_hours_start}
          workingHoursEnd={gridData.working_hours_end}
          sessions={gridData.sessions}
          tracks={gridData.tracks}
          mountNode={mountNode}
          onRun={runAutoschedule}
        />
        <a styleName="toolbar-link" href={trackColorsURL({event_id: eventId})}>
          <Translate>Track colours</Translate>
        </a>
        <ExportButton eventId={eventId} day={gridData.day} />
        <FullscreenButton targetRef={containerRef} />
      </div>
      <div styleName="layout">
        <UnscheduledPanel
          contributions={gridData.unscheduled_contributions ?? []}
          filters={filters}
          showSessionTrack={gridData.show_session_track}
          trackColors={trackColorMap(gridData.tracks)}
          onUnschedule={unscheduleContribution}
          onDragStart={onContributionDragStart}
          onDragEnd={onContributionDragEnd}
        />
        <ScheduleGrid
          gridData={{...shownGridData, columns: visibleColumns}}
          isDimmed={isDimmed}
          contributionDrag={contributionDrag}
          mountNode={mountNode}
          onContributionDragStart={onContributionDragStart}
          onContributionDragEnd={onContributionDragEnd}
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
