# Changelog

All notable changes to the Block Schedule plugin are documented here.

## [Unreleased]

### Added
- Per-column color theming: each column can have its own color, shown
  saturated on the header (with an automatically-chosen readable text
  color) and as a pale tint across the column body.
- Drag-to-reorder columns by dragging one column header onto another.
- "GapSnap": a configurable per-event gap to leave after every
  contribution, with drag-and-drop scheduling snapping to a neighboring
  contribution's edge (± that gap) when dropped nearby.
- An autoscheduler that fills a given timespan automatically: it keeps a
  session's contributions (or, failing that, a track's) scheduled
  back-to-back in the same column, avoids scheduling the same
  session/track in parallel across different columns, schedules
  contributions with neither into any free slot, and respects the
  GapSnap gap between every placed item.
- Column-spanning blocks (e.g. lunch breaks, plenary sessions) that
  render as a single bar across every column for a given time range.
  These are core Indico `Break` timetable entries under the hood, so
  they show up in the regular Timetable too, same as scheduled
  contributions already did.

### Fixed
- Rescheduling a column-spanning block could crash with `Time change of
  ... was not tracked` — the move wasn't wrapped in
  `track_time_changes()`.
- The management/display bundles could fail to render at all
  (`__webpack_require__.nmd is not a function`) once enough client code
  was shared between the two entry points for webpack to split out an
  automatic `common` chunk — plugin builds don't get a shared runtime
  chunk, so a chunk shared between entries with different runtimes can
  execute under the wrong one. Added a plugin-local `webpack.config.mjs`
  that disables chunk splitting for this plugin's own build.

- Initial release: a grid-based alternative timetable (rooms as columns,
  time as rows) added alongside Indico's built-in Timetable.
- Management page: drag-and-drop scheduling from an unscheduled-
  contributions panel onto the grid, with reschedule-by-dragging and
  inline-editable column headers.
- Public display page: read-only grid where each block links to its
  contribution page, with a toggle to highlight the viewer's starred
  ("my timetable") contributions and dim the rest.
- Columns work with or without the Room Booking module: if it's enabled,
  a column can be linked to an existing room (used to prefill the column
  name); either way, the column always has its own editable text label,
  and that label — not the official room name — is what gets written to
  a scheduled contribution's displayed location.
- Block height is proportional to the contribution's actual duration
  (not rounded to the grid's slot size), and each scheduled block shows
  its start–end time in the bottom-right corner.
- A star icon on every block lets the viewer favourite/unfavourite the
  contribution directly from the grid (reuses Indico's existing
  "add to my timetable" favorites, no separate state).
- A fullscreen toggle for both the management and display grids.
- Scheduling writes into Indico's real `TimetableEntry` data, so exports,
  the API, and the core timetable stay consistent with what's shown here.
