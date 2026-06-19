// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useEffect, useState} from 'react';

import {FavoriteStar} from './FavoriteStar';
import {minutesToLabel} from './gridTime';
import {BSContribution} from './types';

import './ContributionBlock.module.scss';

interface ContributionBlockProps {
  contribution: BSContribution;
  eventId: number;
  draggable?: boolean;
  href?: string;
  /** Dim this block unless it's starred (e.g. the display page's "highlight my timetable" toggle). */
  highlightStarred?: boolean;
  showFavorite?: boolean;
  onDragStart?: (event: React.DragEvent, contribution: BSContribution) => void;
  style?: React.CSSProperties;
}

export function ContributionBlock({
  contribution,
  eventId,
  draggable,
  href,
  highlightStarred,
  showFavorite = true,
  onDragStart,
  style,
}: ContributionBlockProps) {
  const [starred, setStarred] = useState(contribution.is_starred);
  useEffect(() => setStarred(contribution.is_starred), [contribution.is_starred]);

  const timeRange =
    contribution.start_minutes !== null
      ? `${minutesToLabel(contribution.start_minutes)}–${minutesToLabel(
          contribution.start_minutes + (contribution.duration_minutes ?? 0)
        )}`
      : null;

  const content = (
    <>
      {showFavorite && (
        <FavoriteStar
          contributionId={contribution.id}
          eventId={eventId}
          starred={starred}
          onChange={setStarred}
        />
      )}
      <div styleName="title">{contribution.title}</div>
      <div styleName="people">{contribution.people.join(', ')}</div>
      {timeRange && <div styleName="time-range">{timeRange}</div>}
    </>
  );

  const dimmed = highlightStarred && !starred;
  const className = ['contribution-block', dimmed ? 'dimmed' : '', starred ? 'starred' : '']
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <a
        href={href}
        styleName={className}
        style={style}
        draggable={draggable}
        onDragStart={e => onDragStart?.(e, contribution)}
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
    >
      {content}
    </div>
  );
}
