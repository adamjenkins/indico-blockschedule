// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import favoriteContributionURL from 'indico-url:contributions.favorite_contributions_api';

import React, {useState} from 'react';
import {Icon} from 'semantic-ui-react';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';

import './FavoriteStar.module.scss';

interface FavoriteStarProps {
  contributionId: number;
  eventId: number;
  initialStarred: boolean;
}

export function FavoriteStar({contributionId, eventId, initialStarred}: FavoriteStarProps) {
  const [starred, setStarred] = useState(initialStarred);
  const [saving, setSaving] = useState(false);
  const url = favoriteContributionURL({contrib_id: contributionId, event_id: eventId});

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) {
      return;
    }
    const newValue = !starred;
    setSaving(true);
    setStarred(newValue);
    try {
      if (newValue) {
        await indicoAxios.put(url);
      } else {
        await indicoAxios.delete(url);
      }
    } catch (error) {
      setStarred(!newValue);
      handleAxiosError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Icon
      name={starred ? 'star' : 'star outline'}
      styleName={`favorite-star ${starred ? 'starred' : ''}`}
      disabled={saving}
      title={
        starred
          ? Translate.string('Remove from my timetable')
          : Translate.string('Add to my timetable')
      }
      onClick={toggle}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      draggable={false}
    />
  );
}
