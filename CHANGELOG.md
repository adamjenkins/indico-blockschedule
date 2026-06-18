# Changelog

All notable changes to the Block Schedule plugin are documented here.

## [Unreleased]

### Added
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
