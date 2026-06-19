# TASKLIST — Block Schedule, round 2

Round 1 (grid scheduling synced to core `TimetableEntry`, columns optionally
linked to rooms, favorite star, fullscreen, public display page) is done —
see git history. This round adds: per-column color theming, drag-to-reorder
columns, "GapSnap" (configurable gap + magnetic snapping while dragging),
an autoscheduler that respects sessions/tracks, and column-spanning blocks
for plenaries/breaks.

## Phase 1 — Column color theming

- [x] `models/columns.py`: add nullable `color` (hex string, no `#`) column
- [x] Migration adding `columns.color` (revises `01d47f24ad61`)
- [x] `util.py` `serialize_column`: include `color`
- [x] `controllers.py` `RHColumnCreate`/`RHColumnDeleteUpdate`: accept and
      validate `color` (6-digit hex or `None`)
- [x] `client/colors.ts`: hex → pale-background and hex → readable
      text-color helpers (no external dep, plain luminance math)
- [x] `AddColumnForm` + `ColumnHeader`: native `<input type="color">` to
      set/edit a column's color
- [x] `ScheduleGrid`: header uses the saturated color as background (with
      computed readable text color); column track uses the pale tint

## Phase 2 — Drag-to-reorder columns

- [x] `RHColumnReorder` (`POST .../columns/reorder`, body `{column_ids}`):
      two-phase position reassignment (temporary negative positions, then
      final) to avoid the `(event_id, position)` unique constraint
      tripping mid-update
- [x] `blueprint.py`: wire the new route
- [x] `ManageApp`/`ScheduleGrid`: column header is draggable with its own
      MIME type (`application/x-bs-column`) so it doesn't collide with
      contribution drags; dropping on another header reorders

## Phase 3 — GapSnap

- [x] `plugin.py`: `gap_minutes` added to `default_event_settings`
      (default `0`)
- [x] `RHGapSettingsUpdate` (`PATCH .../settings`) + route; `_grid_payload`
      already returns all `event_settings` — add `gap_minutes`
- [x] `ManageApp` toolbar: a "Gap after contributions" number input,
      persisted via the new endpoint
- [x] `ScheduleGrid` drop handling: compute candidate snap points from
      neighboring contributions in the target column (their end + gap,
      or their start − gap − dragged duration) and snap to the nearest
      one within one slot's distance of the raw drop point

## Phase 4 — Autoscheduler

- [x] `util.py` `autoschedule(event, start_dt, end_dt, gap)`: groups
      unscheduled contributions by `session_id`, then by `track_id`,
      then leftover standalone; packs each group as a contiguous block
      into whichever column has the earliest free cursor that fits the
      *whole* group (so a session/track never ends up split across
      parallel rooms); items that don't fit as a group fall back to
      individual best-effort placement; gap from Phase 3 is applied
      between every two placed items. Returns contributions it couldn't
      fit in the timespan.
- [x] Shared `assign_contribution_to_column` helper (factored out of
      `RHScheduleContribution`) reused by both the manual-drag endpoint
      and the autoscheduler
- [x] `RHAutoSchedule` (`POST .../autoschedule`, body: start/end day +
      minutes) + route
- [x] `ManageApp`: a small form (start day/time, end day/time, "Run
      autoschedule" button) reusing the existing day-selector data;
      reports how many contributions were placed/left over

## Phase 5 — Column-spanning blocks

- [x] Reuse core's `Break` timetable entries rather than a new table —
      `create_break_entry`/`update_break_entry`/`delete_timetable_entry`
      already exist and keep these in the real Timetable too, consistent
      with how contribution scheduling already works. A spanning block is
      simply a top-level (no parent) `Break` entry; the grid renders every
      such entry for the active day as a full-width bar over all columns.
- [x] `_grid_payload`: add `spanning_blocks` (id, title, start_minutes,
      duration_minutes, color)
- [x] `RHSpanningBlockCreate` (POST), `RHSpanningBlockDeleteUpdate`
      (PATCH move/rename/recolor, DELETE) + routes
- [x] `ScheduleGrid`: render spanning blocks as an absolutely-positioned
      overlay above the column tracks (offset past the time gutter);
      draggable (own MIME type `application/x-bs-spanning`) to reschedule
      vertically; click-to-edit title/color; delete icon
- [x] A small "Add spanning block" form (title, start slot, duration,
      color) in the toolbar

## Phase 6 — Validation

- [x] `ruff`/`isort`/`unbehead` clean; `pytest` (model + util coverage for
      color, reorder position math, autoschedule grouping/packing)
- [x] Rebuild assets, restart `indico-dev.service`, exercise all five
      features against `https://vagrant.wisecat.net/` on the existing
      event 4 dataset: recolor a column, drag-reorder columns, set a gap
      and confirm snapping, run autoschedule over the unscheduled dummy
      contributions and confirm session/track grouping held, add/move/
      delete a spanning block, and confirm everything still round-trips
      through the core Timetable (per the existing sync guarantee)
