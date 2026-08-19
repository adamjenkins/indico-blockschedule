// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

export interface BSColumn {
  id: number;
  room_id: number | null;
  position: number;
  label: string;
  title: string;
  color: string | null;
  min_width_px: number | null;
}

export interface BSRoom {
  id: number;
  full_name: string;
}

export type BSDescriptionDisplay = 'hidden' | 'full' | 'truncated';

export interface BSContribution {
  id: number;
  title: string;
  people: string[];
  duration_minutes: number | null;
  column_id: number | null;
  start_minutes: number | null;
  start_dt: string | null;
  url: string;
  session_name: string | null;
  track_id: number | null;
  track_name: string | null;
  description: string | null;
}

export interface BSSpanningBlock {
  id: number;
  title: string;
  start_minutes: number;
  duration_minutes: number;
  color: string | null;
}

export interface BSSessionBlock {
  id: number;
  session_id: number | null;
  title: string | null;
  start_minutes: number;
  duration_minutes: number;
  color: string | null;
  column_ids: number[] | null;
}

export interface BSSession {
  id: number;
  title: string;
  color: string | null;
}

export interface BSTrack {
  id: number;
  title: string;
  /** `rrggbb` (no leading `#`) chosen by the event manager, or null for the default badge. */
  color: string | null;
}

export interface BSGroup {
  id: number;
  title: string;
  position: number;
  column_ids: number[];
}

export interface BSGridData {
  day: string;
  event_days: string[];
  event_title: string;
  /** The event's logo from the Layout page, or null when none is set. */
  event_logo_url: string | null;
  columns: BSColumn[];
  groups: BSGroup[];
  roombooking_enabled: boolean;
  /** Management payload only; the display endpoint omits it. */
  rooms?: BSRoom[];
  sessions: BSSession[];
  tracks: BSTrack[];
  scheduled_contributions: BSContribution[];
  /** Management payload only; the display endpoint omits it. */
  unscheduled_contributions?: BSContribution[];
  spanning_blocks: BSSpanningBlock[];
  session_blocks: BSSessionBlock[];
  slot_minutes: number;
  day_start_time: string;
  day_end_time: string;
  working_hours_start: string;
  working_hours_end: string;
  gap_minutes: number;
  snap_minutes: number;
  row_height_px: number;
  show_session_track: boolean;
  description_display: BSDescriptionDisplay;
  /** Lines a contribution title may occupy before it is truncated; 0 means no limit. */
  title_max_lines: number;
}
