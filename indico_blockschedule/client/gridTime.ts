// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

/** Fallback used only before grid data (which always carries the event's own `row_height_px`) has loaded. */
export const DEFAULT_ROW_HEIGHT_PX = 60;
export const GUTTER_PX = 80;

export function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function buildSlots(dayStartTime: string, dayEndTime: string, slotMinutes: number): number[] {
  const start = parseTimeToMinutes(dayStartTime);
  const end = parseTimeToMinutes(dayEndTime);
  const slots = [];
  for (let minutes = start; minutes < end; minutes += slotMinutes) {
    slots.push(minutes);
  }
  return slots;
}

export function minutesToLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

/** Pixel offset, from the top of the grid, of a given minute-of-day. */
export function minutesToOffsetPx(minutes: number, dayStartTime: string, slotMinutes: number, rowHeightPx: number): number {
  return ((minutes - parseTimeToMinutes(dayStartTime)) / slotMinutes) * rowHeightPx;
}

/** Pixel height representing a duration, proportional to the actual minutes (not rounded to a slot). */
export function durationToPx(durationMinutes: number | null, slotMinutes: number, rowHeightPx: number): number {
  if (!durationMinutes) {
    return rowHeightPx;
  }
  return (durationMinutes / slotMinutes) * rowHeightPx;
}
