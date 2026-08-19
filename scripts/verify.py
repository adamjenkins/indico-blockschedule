#!/usr/bin/env python3
# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

"""Browser checks for the things unit tests cannot see.

    python3 scripts/verify.py --session <sid> --event <id>

`--session` is the value of the Indico session cookie for a user who can manage
the event (`indico_session` normally, `indico_session_http` on an instance whose
base URL is plain http). Minting one server-side beats putting a password in a
script.

Three behaviours, all asserted numerically:

  * dragging a block does not rebuild the grid (counted as DOM nodes churned
    while sixty dragover events are dispatched);
  * dropping it costs one write and no refetch, and what ends up on screen
    matches what the server has;
  * a contribution the viewer may not see is absent from the public payload and
    from the public spreadsheet export, while a manager still sees it.

The drag is dispatched as real DragEvents sharing one DataTransfer. Playwright's
own drag helpers send mouse events, which do not produce an HTML5 drag at all --
the handlers under test never fire and everything passes for the wrong reason.
"""
import argparse
import sys

from playwright.sync_api import sync_playwright

tally = {'passed': 0, 'failed': 0}


def check(label, ok, detail=''):
    tally['passed' if ok else 'failed'] += 1
    print(f'  {"PASS" if ok else "FAIL"}  {label}' + (f' \u2014 {detail}' if detail else ''))


DRAG = '''(args) => {
    const [targetIndex, moves, offsetY] = args;
    const block = document.querySelector('[class*="scheduled-block"]');
    const source = block.querySelector('[class*="contribution-block"]') || block;
    const tracks = [...document.querySelectorAll('[class*="column-track"]')];
    const target = tracks[targetIndex];
    const box = target.getBoundingClientRect();
    const dt = new DataTransfer();
    const fire = (el, type, extra = {}) =>
        el.dispatchEvent(new DragEvent(type, {dataTransfer: dt, bubbles: true, cancelable: true, ...extra}));

    fire(source, 'dragstart', {clientX: box.left + 5, clientY: box.top + 5});
    window.__mutations = 0;
    const observer = new MutationObserver(records => {
        for (const r of records) { window.__mutations += r.addedNodes.length + r.removedNodes.length; }
    });
    observer.observe(document.querySelector('[class*="body-row"]'), {childList: true, subtree: true});
    for (let i = 0; i < moves; i++) {
        fire(target, 'dragover', {clientX: box.left + 40, clientY: box.top + offsetY + (i % 3)});
    }
    observer.disconnect();
    fire(target, 'drop', {clientX: box.left + 40, clientY: box.top + offsetY});
    fire(source, 'dragend', {});
    return {mutations: window.__mutations, title: (source.textContent || '').slice(0, 20)};
}'''

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://localhost:8000')
parser.add_argument('--session', required=True, help='value of the Indico session cookie')
parser.add_argument('--cookie-name', default='indico_session_http')
parser.add_argument('--event', type=int, required=True)
args = parser.parse_args()

BASE, SID, EVENT = args.base, args.session, args.event
DOMAIN = BASE.split('//', 1)[1].split(':')[0].split('/')[0]

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
    ctx.add_cookies([{'name': args.cookie_name, 'value': SID, 'domain': DOMAIN, 'path': '/'}])
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f'{BASE}/event/{EVENT}/manage/block-schedule/', wait_until='networkidle')
    page.wait_for_selector('[class*="scheduled-block"]', timeout=20000)
    page.wait_for_timeout(1500)

    requests = []
    page.on('request', lambda r: requests.append((r.method, r.url)))
    moves = 60
    # Aim at a slot that is genuinely free: the client refuses an overlapping
    # drop silently, so dropping blind proves nothing about the request path.
    spot = page.evaluate('''async (eventId) => {
        const grid = await (await fetch(`/event/${eventId}/manage/block-schedule/grid-data`,
            {headers: {Accept: 'application/json'}})).json();
        const firstInDom = document.querySelector('[class*="scheduled-block"] [class*="contribution-block"]');
        const title = (firstInDom.querySelector('[class*="title"]') || firstInDom).textContent.trim();
        const dragged = grid.scheduled_contributions.find(c => title.startsWith(c.title.slice(0, 18)))
            || grid.scheduled_contributions[0];
        const duration = dragged.duration_minutes || 30;
        for (let index = 0; index < grid.columns.length; index++) {
            const column = grid.columns[index];
            if (column.id === dragged.column_id) { continue; }
            const busy = grid.scheduled_contributions
                .filter(c => c.column_id === column.id && c.start_minutes !== null)
                .map(c => [c.start_minutes, c.start_minutes + (c.duration_minutes || 0)])
                .sort((a, b) => a[0] - b[0]);
            const toMinutes = t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            const dayEnd = toMinutes(grid.working_hours_end);
            let cursor = toMinutes(grid.working_hours_start);
            for (const [start, end] of busy) {
                if (start - cursor >= duration + 10) { break; }
                cursor = Math.max(cursor, end);
            }
            if (cursor + duration + 10 <= dayEnd) {
                const offset = (cursor / grid.slot_minutes) * grid.row_height_px;
                return {columnIndex: index, offsetY: offset, startMinutes: cursor};
            }
        }
        return null;
    }''', EVENT)
    assert spot, 'no free slot found to drop into'
    print(f"   dropping into column {spot['columnIndex']} at {spot['startMinutes']} minutes")
    requests.clear()   # the probe above fetched grid-data itself
    result = page.evaluate(DRAG, [spot['columnIndex'], moves, spot['offsetY']])
    page.wait_for_timeout(2500)

    # 60 pointer moves over a 30-column, 200-block grid. Rebuilding it once per
    # move would be tens of thousands of nodes.
    check(f'{moves} dragover events do not rebuild the grid', result['mutations'] < 2000,
          f"{result['mutations']} nodes added/removed")
    posts = [u for m, u in requests if m == 'POST' and '/schedule' in u]
    gets = [u for m, u in requests if m == 'GET' and 'grid-data' in u]
    check('the drop issued exactly one write', len(posts) == 1, f'{len(posts)} POSTs')
    check('and did not refetch the whole grid', not gets, f'{len(gets)} grid-data GETs')

    placement = page.evaluate('''async (eventId) => {
        const onScreen = [...document.querySelectorAll('[class*="column-track"]')]
            .map(t => t.querySelectorAll('[class*="scheduled-block"]').length);
        const grid = await (await fetch(`/event/${eventId}/manage/block-schedule/grid-data`,
            {headers: {Accept: 'application/json'}})).json();
        const counts = grid.columns.map(col =>
            grid.scheduled_contributions.filter(c => c.column_id === col.id).length);
        return {onScreen, counts};
    }''', EVENT)
    check('what is on screen matches the server exactly',
          placement['onScreen'] == placement['counts'],
          f"screen {placement['onScreen'][:6]}… server {placement['counts'][:6]}…")
    print('\n== A protected contribution stays out of the public payload ==')
    # Read as a manager first, then as nobody at all: the difference is the
    # whole point of the per-contribution check.
    as_manager = page.evaluate(
        'async (id) => (await (await fetch(`/event/${id}/manage/block-schedule/grid-data`,'
        ' {headers: {Accept: "application/json"}})).json()).scheduled_contributions.length',
        EVENT)
    anonymous = browser.new_context()
    anon_page = anonymous.new_page()
    # It has to be on the origin before it can fetch from it; a blank page is
    # cross-origin to everything.
    anon_page.goto(f'{BASE}/event/{EVENT}/', wait_until='domcontentloaded')
    public = anon_page.evaluate(
        'async (id) => {'
        ' const r = await fetch(`/event/${id}/block-schedule/grid-data`,'
        '   {headers: {Accept: "application/json"}});'
        ' if (!r.ok) { return {status: r.status}; }'
        ' const d = await r.json();'
        ' return {status: r.status, count: d.scheduled_contributions.length,'
        '         titles: d.scheduled_contributions.map(c => c.title)};'
        '}',
        EVENT)

    if public.get('status') != 200:
        print(f"  --   the event is not publicly readable (HTTP {public['status']}); "
              'skipping — protect the event less, or run against a public one')
    else:
        protected = page.evaluate(
            'async (id) => {'
            ' const r = await fetch(`/event/${id}/manage/block-schedule/grid-data`,'
            '   {headers: {Accept: "application/json"}});'
            ' const d = await r.json();'
            ' return d.scheduled_contributions.map(c => c.title);'
            '}',
            EVENT)
        hidden = [t for t in protected if t not in public['titles']]
        if not hidden:
            print('  --   no contribution on this day is protected; nothing to hide. '
                  'Protect one to exercise this properly.')
            check('the public payload is not larger than the management one',
                  public['count'] <= as_manager, f"{public['count']} public vs {as_manager} managed")
        else:
            check('the public payload hides what the viewer may not see',
                  public['count'] == as_manager - len(hidden),
                  f"{as_manager} managed, {public['count']} public, {len(hidden)} hidden")
            csv = anon_page.evaluate(
                'async (id) => (await (await fetch('
                ' `/event/${id}/block-schedule/export/csv`)).text())',
                EVENT)
            leaked = [t for t in hidden if t in csv]
            # A spreadsheet is a copy that leaves the site, so this matters more
            # here than on the page.
            check('and so does the public spreadsheet export', not leaked, str(leaked[:2]))
    anonymous.close()

    check('no JS errors', not errors, '; '.join(errors[:2]))
    browser.close()

print(f'\n{tally["passed"]} passed, {tally["failed"]} failed')
sys.exit(1 if tally['failed'] else 0)
