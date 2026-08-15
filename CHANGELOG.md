# Changelog

All notable changes to the Block Schedule plugin are documented here.

> This is the `release/indico-3.3.12` branch. Entries below describe the
> plugin as a whole; see **Removed** for what this branch drops relative to
> `main`.

## [Unreleased]

### Added
- **A title line limit**, so one long presentation title can no longer push
  the speaker, badges and time out of its block. Titles are truncated with an
  ellipsis after a configurable number of lines — three by default, set per
  event from the management toolbar's "Title lines" box, and 0 for no limit at
  all. The limit applies to the management grid as well as the display page,
  so what is arranged is what gets printed, and the full title remains
  available on hover.
- **A sticky horizontal scrollbar on the display page.** A grid with enough
  rooms scrolls sideways, but its own scrollbar is at the foot of a table
  several screens tall — off-screen exactly when it is wanted. A scrollbar is
  now pinned to the bottom of the window whenever the grid overflows and its
  own is out of sight. Its track and thumb are drawn rather than delegated to
  a native scrollbar, which on macOS (and in several Chrome configurations) is
  an overlay that fades out when idle — invisible, which is the problem being
  solved.

### Changed
- The **"add column", "add spanning block" and "add session block" forms moved
  to the top** of the management workspace, and collapsed behind a row of
  buttons that opens one at a time. They previously sat below a grid that is
  routinely taller than the scroll box, so adding a column meant scrolling past
  the entire day to find the control and then scrolling back.
- The management and display toolbars now **wrap onto more rows instead of
  compressing**. With every event setting on one line, labels had begun
  overlapping each other well before the viewport ran out of width.

## [0.1.1+indico3.3.12] — 2026-08-14

### Removed
- **Contribution favouriting**, for Indico 3.3.12 compatibility: the star on
  each block, the display page's "Highlight my timetable" toggle, and the
  `is_starred` field in the grid payload. It relied on
  `User.favorite_contributions` and the `contributions.favorite_contributions_api`
  endpoint, both added to Indico core after 3.3.12 — on 3.3.12 it broke the
  grid-data endpoint at runtime *and* the webpack build. Full detail and the
  file-by-file list: [COMPATIBILITY-3.3.12.md](COMPATIBILITY-3.3.12.md).
  Users on Indico 3.3.13+ should use `main`, which keeps the feature.

### Packaging
- Tagged releases now publish a **wheel with the frontend assets already
  compiled into it**, so installing needs no Node.js and no Indico source
  checkout on the target server — just `pip install <release url>`. Built by
  `.github/workflows/release.yml`, which refuses to publish a wheel whose
  `static/dist` is empty.
- The version carries a local marker, `0.1.0+indico3.3.12`. Compiled assets are
  only valid for the Indico version they were built against, and without the
  marker a wheel from this branch and one from `main` are named identically —
  indistinguishable once downloaded, and mixing them up produces a page that
  loads but misbehaves.

### Added
- **Room groups and filtering**, so a wide schedule can be viewed and printed
  a slice at a time instead of as one unprintable sheet. Rooms can be gathered
  into named groups ("9th Floor", "Plenary Halls") from a new "Room groups"
  dialog in the management toolbar; a room may belong to any number of groups,
  and groups may overlap freely. The event's tracks are offered as groups too,
  automatically — they are read live from the event rather than copied, so they
  cannot fall out of step with it.
- Both the management and display grids gained a filter bar that narrows the
  view to any combination of groups and individual rooms, and to any set of
  tracks. A track filter keeps every room that hosts at least one of the
  selected talks and greys out that room's other talks rather than hiding them,
  so the printed sheet still shows when a room is occupied; rooms with no
  matching talk drop out entirely.
- Filters are written into the page URL (`?groups=…&rooms=…&tracks=…`), so a
  filtered view — "the 9th floor schedule" — can be bookmarked, handed to
  someone else, or reprinted identically later. The filter controls themselves
  are hidden when printing.
- Spreadsheet export of the schedule (CSV, ODS, Excel) from both the
  management and display toolbars. XLSX/ODS exports carry a second
  "Schedule Grid" sheet laid out like the visual grid itself — one merged,
  multi-line cell per presentation (room, session, track, author(s),
  date, time), spanning exactly the rows its duration covers; CSV stays a
  flat list, since it has no concept of multiple sheets.
- Printing the display page (paper size A4/A3/A2 × orientation), isolated
  to just the grid plus an event-title header — the site's own header,
  side menu, and breadcrumbs are hidden for the print, regardless of the
  current theme's markup. A "Black and white" toggle on the display page
  applies a live greyscale view, which printing simply reflects (there's
  no separate colour choice in the print dialog itself).
- Configurable row height, snap-to-minutes (separate from GapSnap, `0`
  disables it), and per-column minimum width with horizontal scrolling
  when columns don't fit.
- Session/track info on each block, shown as pill badges, with a
  per-event setting to hide them; an optional description preview
  (hidden / truncated / full).
- Manually-placed "session block" banners spanning some or all columns,
  optionally tied to a real session for their title/colour — these are
  presentation-only and never create a core session-block timetable
  entry (see below).
- Sticky column headers and a sticky, internally-scrollable unscheduled-
  contributions panel in the management view; both the grid and that
  panel are capped to 90% of the viewport height.
- Autoscheduler: a "Clear schedule" checkbox that unschedules everything
  in the chosen timespan without immediately rescheduling it; randomized
  placement order on every run (still never splitting a session/track
  across columns); and the ability to exclude specific sessions/tracks
  from being scheduled (or cleared) at all.
- The event's configured working hours render visibly greyed out in the
  management grid, and dragging a contribution there bounces back instead
  of scheduling it.
- Contributions can no longer overlap in the same column/room — enforced
  both server-side (manual drag-and-drop and the autoscheduler) and as an
  instant client-side bounce-back on an overlapping drop.
- A live time preview while dragging a scheduled contribution: a custom
  cursor-following "ghost" box (the native browser drag-image is
  suppressed, since it always paints above the rest of the page and
  can't be drawn over) shows the time it would land on if dropped right
  now, updating as you drag.
- A grid icon next to "Block Schedule" in the management sidemenu, which
  also now sits as its own top-level item directly under "Timetable"
  rather than nested under "Organization".
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

### Changed
- Scheduling a contribution (manually or via the autoscheduler) never
  creates a core `SESSION_BLOCK` timetable entry — a contribution's
  session is snapshotted onto its Block Schedule assignment purely for
  display/grouping, then detached before scheduling, so it always lands
  as a plain top-level entry. Track needs no such handling, since it has
  no equivalent scheduling-time constraint.
- Long titles wrap instead of being truncated; the default row height
  was increased to make room.
- Both the management and display pages now use the page's full
  available width, instead of being capped to a ~700-950px column by the
  surrounding theme.

### Fixed
- The public display page's column headers sat one gutter-width (80px) to the
  left of the columns they label, once a schedule had enough rooms for the
  header row to overflow. The spacer that offsets the header row past the time
  gutter carried no class, so it kept the default `flex-shrink: 1` and was the
  only item in the row able to shrink — the `min-width: 120px` header cells
  could not — so it collapsed to zero and slid every header left. It now uses
  the same non-shrinking `.corner` rule as the management grid. Small schedules
  never showed it, because the row only overflows once the columns stop fitting.
- The display page's "Print…" button didn't visibly do anything while
  the page was in fullscreen — its options popup renders through a
  React portal appended to `<body>` by default, which the Fullscreen API
  hides since only the fullscreened element's own subtree is painted.
  It's now mounted inside the fullscreened container instead.
- Printing the display page left an empty gap on the left where the
  (correctly hidden) side menu used to reserve space — the surrounding
  theme's `margin-left` reservation for it is now cleared for print too.
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
  contribution page.
- Columns work with or without the Room Booking module: if it's enabled,
  a column can be linked to an existing room (used to prefill the column
  name); either way, the column always has its own editable text label,
  and that label — not the official room name — is what gets written to
  a scheduled contribution's displayed location.
- Block height is proportional to the contribution's actual duration
  (not rounded to the grid's slot size), and each scheduled block shows
  its start–end time in the bottom-right corner.
- A fullscreen toggle for both the management and display grids.
- Scheduling writes into Indico's real `TimetableEntry` data, so exports,
  the API, and the core timetable stay consistent with what's shown here.
