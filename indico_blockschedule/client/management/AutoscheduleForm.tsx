// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useState} from 'react';
import {Button, Checkbox, Dropdown, Popup} from 'semantic-ui-react';

import {Param, Translate} from 'indico/react/i18n';

import {parseTimeToMinutes} from '../gridTime';
import {BSSession, BSTrack} from '../types';

import './AutoscheduleForm.module.scss';

interface AutoscheduleResult {
  cleared: boolean;
  unscheduled_count: number;
  unscheduled_titles: string[];
}

interface AutoscheduleFormProps {
  eventDays: string[];
  currentDay: string;
  sessions: BSSession[];
  tracks: BSTrack[];
  onRun: (
    startDay: string,
    startMinutes: number,
    endDay: string,
    endMinutes: number,
    clear: boolean,
    excludeSessionIds: number[],
    excludeTrackIds: number[]
  ) => Promise<AutoscheduleResult | null>;
}

export function AutoscheduleForm({eventDays, currentDay, sessions, tracks, onRun}: AutoscheduleFormProps) {
  const [open, setOpen] = useState(false);
  const [startDay, setStartDay] = useState(currentDay);
  const [startTime, setStartTime] = useState('09:00');
  const [endDay, setEndDay] = useState(eventDays[eventDays.length - 1] ?? currentDay);
  const [endTime, setEndTime] = useState('18:00');
  const [clearSchedule, setClearSchedule] = useState(false);
  const [excludeSessionIds, setExcludeSessionIds] = useState<number[]>([]);
  const [excludeTrackIds, setExcludeTrackIds] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AutoscheduleResult | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    const data = await onRun(
      startDay,
      parseTimeToMinutes(startTime),
      endDay,
      parseTimeToMinutes(endTime),
      clearSchedule,
      excludeSessionIds,
      excludeTrackIds
    );
    setRunning(false);
    setResult(data);
  };

  return (
    <Popup
      on="click"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      position="bottom left"
      trigger={
        <Button type="button">
          <Translate>Autoschedule…</Translate>
        </Button>
      }
      content={
        <div styleName="form">
          <div styleName="row">
            <label>
              <Translate>From</Translate>
            </label>
            <select value={startDay} onChange={e => setStartDay(e.target.value)}>
              {eventDays.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div styleName="row">
            <label>
              <Translate>To</Translate>
            </label>
            <select value={endDay} onChange={e => setEndDay(e.target.value)}>
              {eventDays.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
          {(sessions.length > 0 || tracks.length > 0) && (
            <div styleName="row">
              <label>
                <Translate>Exclude</Translate>
              </label>
              {sessions.length > 0 && (
                <Dropdown
                  placeholder={Translate.string('Sessions…')}
                  multiple
                  selection
                  options={sessions.map(s => ({key: s.id, value: s.id, text: s.title}))}
                  value={excludeSessionIds}
                  onChange={(_e, {value}) => setExcludeSessionIds(value as number[])}
                />
              )}
              {tracks.length > 0 && (
                <Dropdown
                  placeholder={Translate.string('Tracks…')}
                  multiple
                  selection
                  options={tracks.map(t => ({key: t.id, value: t.id, text: t.title}))}
                  value={excludeTrackIds}
                  onChange={(_e, {value}) => setExcludeTrackIds(value as number[])}
                />
              )}
            </div>
          )}
          <Checkbox
            label={Translate.string('Clear schedule (does not reschedule)')}
            checked={clearSchedule}
            onChange={(_e, {checked}) => setClearSchedule(!!checked)}
          />
          <Button primary type="button" loading={running} disabled={running} onClick={run}>
            {clearSchedule ? <Translate>Clear schedule</Translate> : <Translate>Run autoschedule</Translate>}
          </Button>
          {result && (
            <p styleName="result">
              {result.cleared ? (
                <Translate>Schedule cleared for the given timespan.</Translate>
              ) : result.unscheduled_count === 0 ? (
                <Translate>Everything was scheduled.</Translate>
              ) : (
                <Translate>
                  Could not fit <Param name="count" value={result.unscheduled_count} /> contribution(s) in the
                  given timespan: <Param name="titles" value={result.unscheduled_titles.join(', ')} />
                </Translate>
              )}
            </p>
          )}
        </div>
      }
    />
  );
}
