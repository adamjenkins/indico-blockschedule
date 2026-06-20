# TASKLIST — Block Schedule, round 4

Nine independent feature requests landed in one round. Each phase below is
scoped to be implementable and testable on its own; phases that touch
shared files (`types.ts`, grid payload) are ordered so the payload/type
groundwork lands before the UI that consumes it.

## Phase 1 — Sidemenu placement

- [x] `plugin.py`: management sidemenu entry drops `section='organization'`
      and gets `weight=79` (Timetable is `weight=80`, no section — higher
      weight shows first) so "Block Schedule" appears as its own top-level
      item directly under "Timetable", not nested under "Organization".

## Phase 2 — Black & white view toggle, carried into printing

- [x] Display toolbar gets a persistent "Black and white" `Checkbox` next
      to "Highlight my timetable" — toggling it greyscales the on-screen
      grid immediately (CSS `filter: grayscale(1)` via a `bs-bw` class
      applied through normal React `styleName`, not an imperative
      `classList` call), not just the print output.
- [x] `PrintButton`: remove the colour `<select>` entirely — printing
      always reflects whatever the view is currently showing. Keep paper
      size (A4/A3/A2) × orientation (portrait/landscape).
- [x] Print should output *only* the schedule grid (plus a header showing
      the event title), not the surrounding Indico page chrome (global
      header, side menu, breadcrumbs). Implemented generically — walk up
      from the grid container to `<body>`, hiding every sibling at each
      level for the duration of the print, restoring on `afterprint` —
      rather than hardcoding core's current header/sidebar class names.
- [x] `_grid_payload`/`BSGridData` gains `event_title` for the print
      header.
- [x] Verify an actual print preview shows just the grid + title header,
      in both colour and B&W.

## Phase 3 — Spreadsheet export (CSV / ODS / XLSX)

- [x] `odfpy` added as a plugin dependency (core only ships CSV/XLSX
      helpers in `indico.util.spreadsheets`; ODS needs its own writer).
- [x] `util.py`: `build_export_rows(event, day)` — headers + row dicts
      (day, start, end, duration, column/room, title, speakers, session,
      track) for every scheduled contribution on that day, ordered by
      column position then start time; a small local `generate_ods`/
      `send_ods` pair mirroring core's `generate_xlsx`/`send_xlsx` shape.
- [x] One export endpoint per area (`RHDisplayExport`, `RHManageExport`),
      `/export/<fmt>` with `fmt` in `{csv, ods, xlsx}`.
- [x] XLSX/ODS exports carry a second sheet ("Schedule Grid") laid out like
      the visual grid itself (one row per time slot, one column per
      room/column, contribution/session-block/break titles in the cells
      they occupy on screen) alongside the flat "Contributions" list sheet
      — CSV has no concept of multiple sheets, so it stays single-sheet.
- [x] An "Export…" dropdown button (CSV/ODS/Excel) next to Print on the
      display toolbar, and on the management toolbar.

## Phase 4 — Autoscheduler: clear-schedule option + randomized placement order

- [x] `AutoscheduleForm`: an unchecked-by-default "Clear schedule" checkbox.
      When checked, every contribution currently scheduled inside the
      chosen day/time span (across all columns) is unscheduled first, then
      autoschedule runs as normal against the now-empty span.
- [x] `util.py` `autoschedule`: randomize placement order — shuffle which
      group (session/track run) or standalone contribution gets placed
      first, and shuffle item order *within* a standalone batch — while
      still packing a session/track's contributions as one contiguous,
      same-column run (the actual conflict-avoidance logic is untouched).

## Phase 5 — Edit-view layout: sticky panels, bounded height

- [x] `UnscheduledPanel`: `position: sticky; top: 0`, `max-height: 90vh`,
      internally scrollable.
- [x] `ScheduleGrid`'s column-header row: sticky to the top of the grid's
      own scroll container while the body scrolls underneath.
- [x] `.grid-wrapper`: `max-height: 90vh` (already scrolls both axes) so
      neither the grid nor the unscheduled panel can grow taller than the
      viewport.

## Phase 6 — Configurable snap-to-minutes (separate from GapSnap)

- [x] New event setting `snap_minutes` (default 5; `0` disables snapping
      entirely), exposed in the management toolbar and `RHSettingsUpdate`.
- [x] Drag-and-drop scheduling moves from per-slot drop *cells* to a single
      drop zone per column track, computing the raw drop position from
      pointer Y, rounding to the nearest `snap_minutes` (or leaving
      unrounded when `0`) — independent of the existing GapSnap
      neighbor-edge snapping, which still runs afterwards.

## Phase 7 — Grey out non-working hours; block drops there

- [x] `_grid_payload` exposes the event's configured working hours
      (`working_hours_start`/`working_hours_end`, from the existing
      `day_start_time`/`day_end_time` settings) separately from the grid's
      display bounds (which span the full 24h in the edit view).
- [x] Slots/cells outside that range render with a greyed-out background.
- [x] Dropping a contribution there is rejected client-side (no request
      sent) — visually it just "bounces back" to its previous position.

## Phase 8 — Manually-placed "Session block" spanning chosen columns

- [x] New model `BlockScheduleSessionBlock` (event-scoped; optional FK to
      a real `Session` for title/colour; `column_ids` integer array,
      `NULL` meaning "all columns"; start/duration like spanning blocks)
      — deliberately *not* a core `SESSION_BLOCK` timetable entry, per the
      existing "never create session blocks" rule: this is a presentation-
      only grouping banner.
- [x] Migration; CRUD endpoints (create/update/delete) mirroring the
      existing spanning-block ones.
- [x] Management UI: a form to add one, picking an existing session (or a
      free-text title), start time, duration, and which columns it spans
      (defaulting to all).
- [x] Rendered as a banner inside every spanned column's track (reusing
      the existing per-column absolute-positioning math), so it looks
      continuous across however many columns it covers without needing
      cross-flex-column geometry.
- [x] Read-only rendering on the display page.

## Phase 9 — Session/track as pill badges

- [x] `ContributionBlock`: replace the single italic "Session · Track"
      line with two separate pill-style badges (rounded background chips)
      anchored bottom-left, alongside the existing bottom-right time-range
      pill.

## Phase 10 — Validation

- [x] `pytest`, `ruff`, `isort`, `unbehead`, `eslint`, `stylelint` all
      clean.
- [x] Frontend rebuild, `indico-dev.service` restart.
- [x] Live (cookie-injected, no password) re-verification of each phase
      above: B&W toggle + print preview, each export format downloads and
      opens, autoscheduler clear+rerun, sticky/scroll behavior, snapping at
      a couple of `snap_minutes` values, greyed-out non-working hours +
      blocked drop, a session block spanning 2 of 3 columns, pill badges.
- [x] Clean up temporary verification scripts/screenshots before finishing.
