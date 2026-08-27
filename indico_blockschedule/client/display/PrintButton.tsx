// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useState} from 'react';
import {Button, Popup} from 'semantic-ui-react';

import {Translate} from '../i18n';

import {printSchedule} from './printGrid';

import './PrintButton.module.scss';

type PaperSize = 'A4' | 'A3' | 'A2';
type Orientation = 'portrait' | 'landscape';

interface PrintButtonProps {
  containerRef: React.RefObject<HTMLElement>;
  eventTitle: string;
  /** The day being shown (`YYYY-MM-DD`). Printed under the title: the sheet itself shows
   * rooms and times but not which day of a multi-day event it belongs to. */
  day: string;
  /** The active filter spelled out ("Rooms: …" / "Tracks: …"), or null when unfiltered. */
  filterDescription: string | null;
}

/** Colour vs. black-and-white isn't chosen here -- it's the display page's own "Black and
 * white" toggle, and printing always reflects whatever the view is currently showing. */
export function PrintButton({containerRef, eventTitle, day, filterDescription}: PrintButtonProps) {
  const [open, setOpen] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  const print = () => {
    setOpen(false);
    const container = containerRef.current;
    if (container) {
      const subtitle = [day, filterDescription].filter(Boolean).join(' — ');
      // Let the popup actually close before the print-only DOM surgery happens.
      window.setTimeout(() => printSchedule(container, eventTitle, subtitle, paperSize, orientation), 50);
    }
  };

  return (
    <Popup
      on="click"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      position="bottom right"
      // Popup renders its content through a portal appended to <body> by default -- while
      // `containerRef`'s element is in fullscreen (the Fullscreen API only paints that
      // element's own subtree), anything portalled outside of it is invisible, so without
      // this the popup would open but never actually show up on screen. Mounting it inside
      // the fullscreened container instead keeps it visible either way.
      mountNode={containerRef.current ?? undefined}
      trigger={
        <Button type="button" icon="print" content={Translate.string('Print…')} />
      }
      content={
        <div styleName="form">
          <div styleName="row">
            <label>
              <Translate>Paper size</Translate>
            </label>
            <select value={paperSize} onChange={e => setPaperSize(e.target.value as PaperSize)}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="A2">A2</option>
            </select>
          </div>
          <div styleName="row">
            <label>
              <Translate>Orientation</Translate>
            </label>
            <select value={orientation} onChange={e => setOrientation(e.target.value as Orientation)}>
              <option value="landscape">{Translate.string('Landscape')}</option>
              <option value="portrait">{Translate.string('Portrait')}</option>
            </select>
          </div>
          <Button primary type="button" onClick={print}>
            <Translate>Print</Translate>
          </Button>
        </div>
      }
    />
  );
}
