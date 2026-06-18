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
}

export interface BSRoom {
  id: number;
  full_name: string;
}

export interface BSContribution {
  id: number;
  title: string;
  people: string[];
  duration_minutes: number | null;
  column_id: number | null;
  start_minutes: number | null;
  start_dt: string | null;
  url: string;
  is_starred: boolean;
}

export interface BSGridData {
  day: string;
  event_days: string[];
  columns: BSColumn[];
  roombooking_enabled: boolean;
  rooms: BSRoom[];
  scheduled_contributions: BSContribution[];
  unscheduled_contributions: BSContribution[];
  slot_minutes: number;
  day_start_time: string;
  day_end_time: string;
}
