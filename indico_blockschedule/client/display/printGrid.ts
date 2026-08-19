// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

type PaperSize = 'A4' | 'A3' | 'A2';
type Orientation = 'portrait' | 'landscape';

const PAGE_STYLE_ID = 'bs-print-page-style';
const HEADER_ID = 'bs-print-header';

/** `@page { size }` can only be set from a stylesheet, not an inline style -- so the chosen
 * paper size/orientation is injected as a one-off <style> tag right before printing. */
function setPrintPageStyle(paperSize: PaperSize, orientation: Orientation) {
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${paperSize} ${orientation}; }`;
}

/**
 * Print only `container` (plus a one-off header showing `title`, with `subtitle` -- the day
 * and the active filter -- under it), hiding the rest of the page -- core's global header,
 * the event side menu, breadcrumbs, etc. -- regardless of what those happen to be called in
 * the current theme. Walks from `container` up to <body>, hiding every sibling encountered
 * at each level for the duration of the print, then restores everything once printing is
 * done (or cancelled).
 */
export function printSchedule(
  container: HTMLElement,
  title: string,
  subtitle: string,
  paperSize: PaperSize,
  orientation: Orientation
) {
  setPrintPageStyle(paperSize, orientation);

  const header = document.createElement('div');
  header.id = HEADER_ID;
  const titleLine = document.createElement('div');
  titleLine.textContent = title;
  header.appendChild(titleLine);
  if (subtitle) {
    const subtitleLine = document.createElement('div');
    subtitleLine.className = 'bs-print-subtitle';
    subtitleLine.textContent = subtitle;
    header.appendChild(subtitleLine);
  }
  container.insertBefore(header, container.firstChild);

  const hidden: {el: HTMLElement; display: string}[] = [];
  let node: HTMLElement | null = container;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (parent) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          hidden.push({el: sibling, display: sibling.style.display});
          sibling.style.display = 'none';
        }
      }
    }
    node = parent;
  }

  // If the page were left in this state -- everything but the grid `display: none` -- the
  // only way back would be a reload, so restoration cannot hinge on `afterprint` alone:
  // a `matchMedia('print')` listener catches leaving print mode where the event is flaky,
  // and a timeout after `window.print()` returns is the net under both. Whichever fires
  // first wins; the flag makes the others no-ops.
  let done = false;
  const listeners = new AbortController();
  const cleanup = () => {
    if (done) {
      return;
    }
    done = true;
    header.remove();
    hidden.forEach(({el, display}) => {
      el.style.display = display;
    });
    // The @page style is one-shot too (the next print re-injects it): left in place it
    // would silently impose this print's paper size on anything else the page prints.
    document.getElementById(PAGE_STYLE_ID)?.remove();
    listeners.abort();
  };
  window.addEventListener('afterprint', cleanup, {signal: listeners.signal});
  window.matchMedia('print').addEventListener(
    'change',
    event => {
      if (!event.matches) {
        cleanup();
      }
    },
    {signal: listeners.signal}
  );

  window.setTimeout(() => {
    window.print();
    // Where `window.print()` blocks (the common case), the dialog has closed by now and
    // `afterprint` has normally already cleaned up; where it doesn't block, this must stay
    // generous enough not to restore the page while the dialog is still open on top of it.
    window.setTimeout(cleanup, 15000);
  }, 50);
}
