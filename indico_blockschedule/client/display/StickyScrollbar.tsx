// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';

import './StickyScrollbar.module.scss';

interface StickyScrollbarProps {
  /** The element that actually scrolls horizontally. */
  targetRef: React.RefObject<HTMLElement>;
  /**
   * Anything whose change can alter the grid's width -- the day on show, the number of visible
   * columns. A `ResizeObserver` only sees the *box*, which never changes here: the grid grows
   * along its scroll width instead, so content changes have to be announced.
   */
  revision?: unknown;
}

interface Geometry {
  /** Where the grid is, so the bar can sit directly under it. */
  left: number;
  width: number;
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
}

/** Smallest thumb that is still comfortably grabbable, however long the day's grid is. */
const MIN_THUMB_PX = 40;

/**
 * A horizontal scrollbar pinned to the bottom of the viewport.
 *
 * A grid with enough rooms overflows sideways, but its own scrollbar sits at the bottom of the
 * *grid*, which on a full day is several screens below the fold -- so the one control that
 * reveals the rooms off to the right is invisible exactly when it is needed. This puts a
 * scrollbar where it can always be seen and used.
 *
 * The track and thumb are drawn rather than delegated to a real overflowing element, which
 * would have been less code. The reason is that a native scrollbar cannot be relied on to be
 * *visible*: macOS, and Chrome on several platforms, use overlay scrollbars that occupy no
 * space and fade out when idle, and Chrome ignores `::-webkit-scrollbar` styling outright once
 * `scrollbar-width`/`scrollbar-color` are set. A bar you cannot see is the bug being fixed
 * here, so the thumb is ours and is always painted.
 *
 * It appears only while it would help -- the grid overflows, part of it is on screen, and its
 * own scrollbar is not (which also covers fullscreen, where the grid fits the window and shows
 * its scrollbar normally).
 */
export function StickyScrollbar({targetRef, revision}: StickyScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const target = targetRef.current;
    if (!target) {
      setGeometry(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const overflows = target.scrollWidth > target.clientWidth + 1;
    const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
    const ownScrollbarVisible = rect.bottom <= window.innerHeight;
    if (!overflows || !onScreen || ownScrollbarVisible) {
      setGeometry(null);
      return;
    }
    const next: Geometry = {
      left: rect.left,
      width: rect.width,
      scrollWidth: target.scrollWidth,
      clientWidth: target.clientWidth,
      scrollLeft: target.scrollLeft,
    };
    // Same object back when nothing moved: this runs on every scroll event, and a fresh object
    // each time would re-render for a scroll that changed nothing.
    setGeometry(prev =>
      prev &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.scrollWidth === next.scrollWidth &&
      prev.clientWidth === next.clientWidth &&
      prev.scrollLeft === next.scrollLeft
        ? prev
        : next
    );
  }, [targetRef]);

  useEffect(() => {
    measure();
    const target = targetRef.current;
    window.addEventListener('scroll', measure, {passive: true});
    window.addEventListener('resize', measure);
    target?.addEventListener('scroll', measure, {passive: true});
    const observer = new ResizeObserver(measure);
    if (target) {
      observer.observe(target);
    }
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      target?.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure, targetRef, revision]);

  const maxScroll = geometry ? geometry.scrollWidth - geometry.clientWidth : 0;
  const trackWidth = geometry ? geometry.width : 0;
  const thumbWidth = geometry
    ? Math.max(MIN_THUMB_PX, Math.round((geometry.clientWidth / geometry.scrollWidth) * trackWidth))
    : 0;
  const travel = Math.max(0, trackWidth - thumbWidth);
  const thumbLeft = maxScroll > 0 && geometry ? (geometry.scrollLeft / maxScroll) * travel : 0;

  /** Move the grid so the thumb's left edge lands at `position` px along the track. */
  const scrollToThumbPosition = useCallback(
    (position: number) => {
      const target = targetRef.current;
      if (!target || travel <= 0) {
        return;
      }
      target.scrollLeft = (Math.min(Math.max(position, 0), travel) / travel) * maxScroll;
    },
    [targetRef, travel, maxScroll]
  );

  // Dragging is tracked on the window rather than on the thumb: a pointer moving faster than
  // React re-renders will leave the thumb behind, and a listener on the thumb itself would then
  // stop receiving moves mid-drag.
  useEffect(() => {
    if (!dragging) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      const track = trackRef.current;
      if (!track) {
        return;
      }
      event.preventDefault();
      scrollToThumbPosition(event.clientX - track.getBoundingClientRect().left - thumbWidth / 2);
    };
    const stop = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [dragging, scrollToThumbPosition, thumbWidth]);

  if (!geometry) {
    return null;
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const offset = event.clientX - track.getBoundingClientRect().left;
    // Grabbing the thumb starts a drag from where it already is; pressing the bare track jumps
    // there first, which is what a scrollbar does and saves a drag for a long journey.
    if (offset < thumbLeft || offset > thumbLeft + thumbWidth) {
      scrollToThumbPosition(offset - thumbWidth / 2);
    }
    setDragging(true);
  };

  // Rendered into `<body>` rather than in place: the grid's own "Black and white" toggle is a
  // CSS `filter`, and a filtered ancestor becomes the containing block for `position: fixed`
  // descendants -- which would pin this to the bottom of the grid, the very thing it exists to
  // avoid. Being a body child also means the print routine (which hides everything around the
  // grid) and fullscreen both hide it for free.
  return ReactDOM.createPortal(
    <div
      styleName={dragging ? 'sticky-scrollbar dragging' : 'sticky-scrollbar'}
      ref={trackRef}
      style={{left: geometry.left, width: geometry.width}}
      onPointerDown={onPointerDown}
      // A duplicate of a control the grid already has: nothing here for a screen reader, and no
      // tab stop, since keyboard scrolling belongs to the grid itself.
      aria-hidden="true"
    >
      <div styleName="thumb" style={{width: thumbWidth, transform: `translateX(${thumbLeft}px)`}} />
    </div>,
    document.body
  );
}
