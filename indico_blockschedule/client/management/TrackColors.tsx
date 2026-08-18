// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import manageURL from 'indico-url:plugin_blockschedule.manage';
import trackColorsUpdateURL from 'indico-url:plugin_blockschedule.track_colors_update';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';
import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import {Button, Message} from 'semantic-ui-react';

import {contrastRatio, readableTextColor} from '../colors';
import {BSTrack} from '../types';

import './TrackColors.module.scss';

/** The colour a track badge falls back to, matching `.badge-track` in the block stylesheet. */
const DEFAULT_BADGE = '8a4baf';

/**
 * A starting palette.
 *
 * Ten colours a manager can assign without opening a colour picker, chosen to stay
 * distinguishable from each other rather than to be pretty: a schedule sheet is read at
 * arm's length and printed, and two tracks a shade apart are two tracks nobody can tell
 * apart. All of them are dark enough to take white text, but nothing depends on that --
 * the badge computes its own text colour whatever is picked here.
 */
const PALETTE = [
  '1f6feb',
  '0d7d6f',
  '2f7d32',
  '8a6d00',
  'b35309',
  'c0392b',
  'a4306f',
  '7d3cc4',
  '4a5568',
  '00636e',
];

interface TrackColorsAppProps {
  eventId: number;
  tracks: BSTrack[];
}

/**
 * Assign a colour to each of the event's tracks.
 *
 * The colour lives with this plugin, not with the track: core's `Track` has no colour of
 * its own, and adding one would mean migrating a core table from a plugin.
 *
 * Nothing here lets anyone choose the *text* colour. It is derived from the background --
 * see `readableTextColor` -- which is what keeps every badge legible no matter how dark or
 * pale the colour someone picks. The ratio is shown next to each swatch so that promise is
 * something the page demonstrates rather than something it asserts.
 */
export function TrackColorsApp({eventId, tracks}: TrackColorsAppProps) {
  const [colors, setColors] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(tracks.map(track => [track.id, track.color]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (trackId: number, color: string | null) => {
    setColors(current => ({...current, [trackId]: color}));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await indicoAxios.patch(trackColorsUpdateURL({event_id: eventId}), {colors});
      setSaved(true);
    } catch (error) {
      handleAxiosError(error);
    } finally {
      setSaving(false);
    }
  };

  if (tracks.length === 0) {
    return (
      <Message info>
        <Translate>
          This event has no tracks yet. Add tracks under Programme, then come back here to give
          them colours.
        </Translate>
      </Message>
    );
  }

  return (
    <div styleName="page">
      <p styleName="intro">
        <Translate>
          The colour a track is given here is used for its badge on every contribution in the
          block schedule, on the management grid and on the display page alike. Tracks left
          without a colour keep the default.
        </Translate>
      </p>

      <div styleName="tracks">
        {tracks.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            color={colors[track.id] ?? null}
            onChange={color => set(track.id, color)}
          />
        ))}
      </div>

      <div styleName="actions">
        <Button primary loading={saving} disabled={saving} onClick={save}>
          <Translate>Save colours</Translate>
        </Button>
        <a className="i-button" href={manageURL({event_id: eventId})}>
          <Translate>Back to the schedule</Translate>
        </a>
        {saved && (
          <span styleName="saved">
            <Translate>Saved.</Translate>
          </span>
        )}
      </div>
    </div>
  );
}

function TrackRow({
  track,
  color,
  onChange,
}: {
  track: BSTrack;
  color: string | null;
  onChange: (color: string | null) => void;
}) {
  const effective = color ?? DEFAULT_BADGE;
  const textColor = readableTextColor(`#${effective}`);
  const ratio = contrastRatio(`#${effective}`, textColor);

  return (
    <div styleName="track">
      <div styleName="preview">
        <span styleName="badge" style={{backgroundColor: `#${effective}`, color: textColor}}>
          {track.title}
        </span>
      </div>

      <div styleName="controls">
        <input
          type="color"
          aria-label={Translate.string('Colour for {track}', {track: track.title})}
          value={`#${effective}`}
          onChange={e => onChange(e.target.value.replace('#', ''))}
        />
        <div styleName="swatches">
          {PALETTE.map(candidate => (
            <button
              key={candidate}
              type="button"
              styleName={candidate === color ? 'swatch chosen' : 'swatch'}
              style={{backgroundColor: `#${candidate}`}}
              title={`#${candidate}`}
              onClick={() => onChange(candidate)}
            />
          ))}
        </div>
        <button type="button" styleName="reset" disabled={color === null} onClick={() => onChange(null)}>
          <Translate>Default</Translate>
        </button>
      </div>

      <div styleName="ratio" title={Translate.string('WCAG contrast ratio of the badge text against its background')}>
        {ratio.toFixed(1)}:1
      </div>
    </div>
  );
}

customElements.define(
  'ind-blockschedule-track-colors',
  class extends HTMLElement {
    connectedCallback() {
      const eventId = JSON.parse(this.getAttribute('event-id') ?? '0');
      const tracks = JSON.parse(this.getAttribute('tracks') ?? '[]');
      ReactDOM.render(<TrackColorsApp eventId={eventId} tracks={tracks} />, this);
    }
  }
);
