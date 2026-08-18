// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import {Translate} from 'indico/react/i18n';
import React from 'react';

import {ContributionBlock} from '../ContributionBlock';
import {BSContribution} from '../types';

import './UnscheduledPanel.module.scss';

interface UnscheduledPanelProps {
  eventId: number;
  contributions: BSContribution[];
  showSessionTrack: boolean;
  /** Track id -> `rrggbb`, so badges match the grid the contributions are dragged into. */
  trackColors: Map<number, string>;
  onUnschedule: (contributionId: number) => void;
}

export function UnscheduledPanel({
  eventId,
  contributions,
  showSessionTrack,
  trackColors,
  onUnschedule,
}: UnscheduledPanelProps) {
  const onDragStart = (event: React.DragEvent, contribution: BSContribution) => {
    event.dataTransfer.setData('text/plain', String(contribution.id));
  };

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
      {contributions.map(contribution => (
        <ContributionBlock
          key={contribution.id}
          contribution={contribution}
          eventId={eventId}
          draggable
          showSessionTrack={showSessionTrack}
          trackColor={contribution.track_id === null ? null : trackColors.get(contribution.track_id)}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}
