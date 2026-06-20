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
 * Print only `container` (plus a one-off header showing `title`), hiding the rest of the
 * page -- core's global header, the event side menu, breadcrumbs, etc. -- regardless of what
 * those happen to be called in the current theme. Walks from `container` up to <body>, hiding
 * every sibling encountered at each level for the duration of the print, then restores
 * everything once printing is done (or cancelled).
 */
export function printSchedule(
  container: HTMLElement,
  title: string,
  paperSize: PaperSize,
  orientation: Orientation
) {
  setPrintPageStyle(paperSize, orientation);

  const header = document.createElement('div');
  header.id = HEADER_ID;
  header.textContent = title;
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

  const cleanup = () => {
    header.remove();
    hidden.forEach(({el, display}) => {
      el.style.display = display;
    });
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.setTimeout(() => window.print(), 50);
}
