// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import {BSColumn, BSContribution, BSGridData} from './types';

/**
 * Which rooms and tracks a view is currently restricted to.
 *
 * All three are "empty means everything", so the no-filter case needs no
 * special value and an absent URL parameter means the same as an empty one.
 */
export interface BSFilters {
  groupIds: number[];
  roomIds: number[];
  trackIds: number[];
}

export const EMPTY_FILTERS: BSFilters = {groupIds: [], roomIds: [], trackIds: []};

const PARAMS: [keyof BSFilters, string][] = [
  ['groupIds', 'groups'],
  ['roomIds', 'rooms'],
  ['trackIds', 'tracks'],
];

function parseIds(raw: string | null): number[] {
  if (!raw) {
    return [];
  }
  return [...new Set(raw.split(',').map(x => parseInt(x, 10)).filter(n => Number.isFinite(n)))];
}

/** Read filters out of a query string (`?rooms=1,2&tracks=7`). */
export function parseFilters(search: string): BSFilters {
  const params = new URLSearchParams(search);
  return {
    groupIds: parseIds(params.get('groups')),
    roomIds: parseIds(params.get('rooms')),
    trackIds: parseIds(params.get('tracks')),
  };
}

/** Render filters back into a query string, omitting whatever is unset. */
export function serializeFilters(filters: BSFilters): string {
  const params = new URLSearchParams();
  for (const [key, param] of PARAMS) {
    if (filters[key].length) {
      params.set(param, filters[key].join(','));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function hasActiveFilters(filters: BSFilters): boolean {
  return PARAMS.some(([key]) => filters[key].length > 0);
}

/**
 * Push the current filters into the address bar without navigating, so a
 * filtered view can be bookmarked, shared, or reprinted identically later.
 * `replaceState` rather than `pushState`: ticking room checkboxes should not
 * bury the page under a pile of back-button steps.
 */
export function syncFiltersToUrl(filters: BSFilters) {
  const url = `${window.location.pathname}${serializeFilters(filters)}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}

export interface FilteredGrid {
  /** The columns to render, in their original order. */
  columns: BSColumn[];
  /** True when this contribution falls outside the track filter and should be greyed out. */
  isDimmed: (contribution: BSContribution) => boolean;
  /** How many columns exist in total, for "12 of 30 rooms" style summaries. */
  totalColumns: number;
}

/**
 * Apply `filters` to a grid payload.
 *
 * Room selection is the union of the selected groups' rooms and any
 * individually selected rooms — picking "9th floor" plus one hall on another
 * floor gives exactly those, which is how people describe what they want to
 * print.
 *
 * The track filter deliberately does NOT remove talks from the rooms it
 * keeps. A room survives if it hosts at least one talk in the selected
 * tracks, and its other talks are then greyed out rather than hidden: the
 * printed sheet still tells you the room is busy at 14:00, which a sheet with
 * holes in it does not. Rooms with no matching talk at all drop out, since
 * they are just noise on a track sheet.
 */
export function applyFilters(gridData: BSGridData, filters: BSFilters): FilteredGrid {
  const allColumns = gridData.columns;
  const trackIds = new Set(filters.trackIds);
  const isDimmed = (contribution: BSContribution) =>
    trackIds.size > 0 && (contribution.track_id === null || !trackIds.has(contribution.track_id));

  // -- rooms: union of selected groups and individually selected rooms
  const selected = new Set<number>(filters.roomIds);
  if (filters.groupIds.length) {
    const groupIds = new Set(filters.groupIds);
    for (const group of gridData.groups) {
      if (groupIds.has(group.id)) {
        group.column_ids.forEach(id => selected.add(id));
      }
    }
  }
  let columns = selected.size ? allColumns.filter(c => selected.has(c.id)) : allColumns;

  // -- tracks: keep only rooms that actually host one of the selected tracks
  if (trackIds.size) {
    const columnsWithMatch = new Set(
      gridData.scheduled_contributions
        .filter(c => c.column_id !== null && c.track_id !== null && trackIds.has(c.track_id))
        .map(c => c.column_id as number)
    );
    columns = columns.filter(c => columnsWithMatch.has(c.id));
  }

  return {columns, isDimmed, totalColumns: allColumns.length};
}
