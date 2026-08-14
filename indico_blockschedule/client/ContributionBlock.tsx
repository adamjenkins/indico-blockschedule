// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React from 'react';

import {minutesToLabel} from './gridTime';
import {BSContribution} from './types';

import './ContributionBlock.module.scss';

interface ContributionBlockProps {
  contribution: BSContribution;
  draggable?: boolean;
  href?: string;
  /** Grey this block out: it is outside the current track filter, but its room is shown. */
  dimmed?: boolean;
  showSessionTrack?: boolean;
  /** While this block is being dragged, the prospective start minute it would land on if
   * dropped right now -- overrides the displayed time range and highlights it, so the time
   * updates live as the block is dragged around instead of only after it's dropped. */
  previewStartMinutes?: number | null;
  onDragStart?: (event: React.DragEvent, contribution: BSContribution) => void;
  onDragEnd?: (event: React.DragEvent, contribution: BSContribution) => void;
  style?: React.CSSProperties;
}

export function ContributionBlock({
  contribution,
  draggable,
  href,
  dimmed,
  showSessionTrack = true,
  previewStartMinutes,
  onDragStart,
  onDragEnd,
  style,
}: ContributionBlockProps) {
  const displayedStartMinutes = previewStartMinutes ?? contribution.start_minutes;
  const timeRange =
    displayedStartMinutes !== null && displayedStartMinutes !== undefined
      ? `${minutesToLabel(displayedStartMinutes)}–${minutesToLabel(
          displayedStartMinutes + (contribution.duration_minutes ?? 0)
        )}`
      : null;
  const isPreview = previewStartMinutes !== null && previewStartMinutes !== undefined;

  const content = (
    <>
      <div styleName="title">{contribution.title}</div>
      <div styleName="people">{contribution.people.join(', ')}</div>
      {showSessionTrack && (contribution.session_name || contribution.track_name) && (
        <div styleName="badges">
          {contribution.session_name && <span styleName="badge badge-session">{contribution.session_name}</span>}
          {contribution.track_name && <span styleName="badge badge-track">{contribution.track_name}</span>}
        </div>
      )}
      {contribution.description && <div styleName="description">{contribution.description}</div>}
      {timeRange && <div styleName={isPreview ? 'time-range time-range-preview' : 'time-range'}>{timeRange}</div>}
    </>
  );

  const className = ['contribution-block', dimmed ? 'dimmed' : ''].filter(Boolean).join(' ');

  if (href) {
    return (
      <a
        href={href}
        styleName={className}
        style={style}
        draggable={draggable}
        onDragStart={e => onDragStart?.(e, contribution)}
        onDragEnd={e => onDragEnd?.(e, contribution)}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      styleName={className}
      style={style}
      draggable={draggable}
      onDragStart={e => onDragStart?.(e, contribution)}
      onDragEnd={e => onDragEnd?.(e, contribution)}
    >
      {content}
    </div>
  );
}
