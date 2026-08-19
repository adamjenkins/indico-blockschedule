// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React from 'react';

import {BSContribution} from '../types';

// A transparent 1x1 GIF, used as the native drag image (see `setDragImage` below) -- the
// browser's own drag-image snapshot is rendered in a compositing layer above *everything* on
// the page, including elements with the highest possible `z-index`, so a real DOM element
// (like the time tooltip) can never appear on top of it. Suppressing it with this and
// rendering our own cursor-following ghost box instead keeps everything in the normal page
// stacking order, where z-index actually works.
const EMPTY_DRAG_IMAGE = typeof Image !== 'undefined' ? new Image() : null;
if (EMPTY_DRAG_IMAGE) {
  EMPTY_DRAG_IMAGE.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
}

/**
 * A contribution drag in progress.
 *
 * Both the grid and the unscheduled panel can start one, and the grid draws the
 * ghost and time preview for either, so the state lives in `ManageApp` (their
 * common parent) rather than in whichever component the drag happened to begin
 * in.
 */
export interface ContributionDragState {
  contribution: BSContribution;
  /** Where, within the dragged block, the cursor grabbed it, and the block's own size --
   * captured once at dragstart -- so the ghost can be drawn at the position and size the
   * suppressed native drag image would have had. */
  grabOffset: {offsetX: number; offsetY: number; width: number; height: number};
}

/** The dragstart bookkeeping shared by every place a contribution drag can begin:
 * put the id on the `dataTransfer`, suppress the native drag image (the ghost box
 * stands in for it), and capture where the block was grabbed. */
export function startContributionDrag(
  event: React.DragEvent,
  contribution: BSContribution
): ContributionDragState {
  event.dataTransfer.setData('text/plain', String(contribution.id));
  if (EMPTY_DRAG_IMAGE) {
    event.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
  }
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    contribution,
    grabOffset: {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}
