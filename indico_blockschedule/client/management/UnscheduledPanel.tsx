// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useMemo, useState} from 'react';
import {Input} from 'semantic-ui-react';

import {ContributionBlock} from '../ContributionBlock';
import {BSFilters, filterUnscheduled} from '../filters';
import {Translate} from '../i18n';
import {BSContribution} from '../types';

import './UnscheduledPanel.module.scss';

interface UnscheduledPanelProps {
  eventId: number;
  contributions: BSContribution[];
  /** The toolbar's active filters -- the track filter narrows this panel like it narrows the grid. */
  filters: BSFilters;
  showSessionTrack: boolean;
  /** Track id -> `rrggbb`, so badges match the grid the contributions are dragged into. */
  trackColors: Map<number, string>;
  onUnschedule: (contributionId: number) => void;
  /** Drag handlers shared with the grid (via `ManageApp`), so a drag that starts here gets
   * the same ghost and live time preview as one that starts on an already-scheduled block. */
  onDragStart: (event: React.DragEvent, contribution: BSContribution) => void;
  onDragEnd: () => void;
}

export function UnscheduledPanel({
  eventId,
  contributions,
  filters,
  showSessionTrack,
  trackColors,
  onUnschedule,
  onDragStart,
  onDragEnd,
}: UnscheduledPanelProps) {
  const [query, setQuery] = useState('');

  // Finding one talk in a 200-item scrolling column is this panel's whole job, so it gets
  // its own text filter (over title and speakers) on top of the toolbar's track filter.
  const visible = useMemo(() => {
    const filtered = filterUnscheduled(contributions, filters);
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return filtered;
    }
    return filtered.filter(
      c => c.title.toLowerCase().includes(needle) || c.people.some(p => p.toLowerCase().includes(needle))
    );
  }, [contributions, filters, query]);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const contributionId = Number(event.dataTransfer.getData('text/plain'));
    if (contributionId) {
      onUnschedule(contributionId);
    }
  };

  return (
    <div styleName="panel" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <h3>
        <Translate>Unscheduled contributions</Translate>
      </h3>
      {contributions.length === 0 && (
        <p styleName="empty">
          <Translate>All contributions are scheduled.</Translate>
        </p>
      )}
      {contributions.length > 0 && (
        <Input
          styleName="search"
          icon="search"
          fluid
          size="mini"
          placeholder={Translate.string('Filter by title or speaker…')}
          value={query}
          onChange={(_e, {value}) => setQuery(value)}
        />
      )}
      {contributions.length > 0 && visible.length === 0 && (
        <p styleName="empty">
          <Translate>No unscheduled contributions match the current filters.</Translate>
        </p>
      )}
      {visible.map(contribution => (
        <ContributionBlock
          key={contribution.id}
          contribution={contribution}
          eventId={eventId}
          draggable
          showSessionTrack={showSessionTrack}
          trackColor={contribution.track_id === null ? null : trackColors.get(contribution.track_id)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}
