# Changelog

All notable changes to the Block Schedule plugin are documented here.

> This is the `release/indico-3.3.12` branch. Entries below describe the
> plugin as a whole; see **Removed** for what this branch drops relative to
> `main`.

## [0.1.4+indico3.3.12] — 2026-08-19

### Fixed
- **The display grid and the exports now apply Indico's per-contribution access
  check.** They previously only asked whether the *event* was readable, so a
  contribution protected inside a public event was served to anyone who opened
  the schedule — and downloadable as a spreadsheet, and cached onto phones by
  the app. Core's own timetable filters each entry this way; the plugin now does
  too. Management endpoints are unchanged: a manager arranging the grid still
  sees everything in it.
- **An out-of-range `start_minutes` is a 400, not a 500.** Every handler's
  client-supplied minutes funnel through one range check now; `24:00` stays
  valid as an end-of-day bound and means the following midnight.
- **The column PATCH no longer accepts `position`.** A raw position write trips
  the `(event_id, position)` unique constraint whenever the target slot is
  taken; reordering goes through the reorder endpoint's two-phase renumbering,
  which exists for exactly that reason.
- **Deleting a column prunes it from session-block banners.** The banners list
  the columns they span by id, with nothing at the database level tying those
  ids to the columns table, so a deleted column left dangling ids behind. A
  banner left spanning nothing at all is deleted along with the column: it
  renders nowhere, and its only delete control lives on the rendered bar.
- **A spanning block no longer swallows drops across its whole time band.** The
  bar spans the full grid width as a sibling of the column tracks and has no
  drop handlers of its own, so while a contribution drag is live it now lets
  pointer events fall through to the columns beneath it. Outside a drag it
  stays interactive — its drag handle, colour input and close icon all need
  the pointer.
- **Popups and modals now open visibly in fullscreen.** The autoschedule popup,
  the room-groups modal and the new delete confirmations portal into
  `document.body` by default, which the Fullscreen API does not paint — so they
  opened invisibly, and a modal then also trapped focus in content the user
  could not see. They all mount inside the fullscreenable container now, the
  same fix the display page's print popup got in 0.1.1.
- **A drag from the unscheduled panel now shows the same ghost and live time
  preview as a drag within the grid.** The drag state moved up to the
  workspace, shared by both origins, and pointer tracking is document-wide for
  the duration of the drag — a drag that starts in the panel spends its first
  stretch outside any column track.
- **Printing can no longer leave the page blank, or resize someone else's
  print.** Restoring the page — everything but the grid is `display: none`
  during the print — no longer hinges on `afterprint` alone: leaving print
  mode and a timeout after `window.print()` returns both back it up, and
  whichever fires first wins. The injected `@page` style is removed afterwards
  too, rather than silently imposing this print's paper size on anything else
  the page prints. And blocks are no longer sliced in half across page
  boundaries, which made both halves unreadable.

### Changed
- **The grid payload is built with one query instead of hundreds.** Walking the
  event's contributions let every row lazy-load its timetable entry, assignment,
  track and speakers: measured at **630 queries and 0.62 s** for a 200-talk day.
  Loading them together makes it **12 queries and 0.04 s**, and the endpoint as a
  whole went from 0.68 s to 0.06 s. It is fetched on every refresh by every
  phone, and by the manager after every drag.
- **Scheduling and unscheduling a talk no longer refetch the whole grid.** Both
  endpoints already returned the contribution they changed, so the management
  view applies it directly. Renaming or recolouring a column does the same. The
  structural operations — autoschedule, clear, adding and deleting columns —
  still reload, because they change more than they report. The cost is that a
  second manager's concurrent edits no longer appear by themselves; they did
  before only at the price of a full grid rebuild after every drag.
- **Dragging a block no longer rebuilds the grid on every pointer move.** The
  pointer position moved out of React state, so a move only re-renders when the
  snapped start minute actually changes; the ghost follows the cursor from a ref
  via `requestAnimationFrame`, and the column background cells are memoised.
  Measured over sixty drag events on a 30-column, 200-block grid: **no DOM nodes
  added or removed at all**, where before it was the whole grid each time.
- **The autoscheduler fills each day's working hours, not one continuous
  span.** A multi-day request used to be a single `[start..end]` interval, so
  it packed talks straight through the nights between days. It now builds one
  window per day, clipped to the event's working hours — the requested start
  and end times clip the first and last day further — and nothing is ever
  placed outside a window, nor is a session's contiguous run ever split across
  two of them. The form's proposed times come from the working-hours settings
  instead of a hard-coded 09:00–18:00.
- **The display payload no longer carries `rooms` or
  `unscheduled_contributions`.** Neither is read by the display page or the
  phone app, and they were the payload's most sensitive parts: `rooms` is an
  instance-wide, unpaginated directory once Room Booking is on, and the
  unscheduled list is exactly the slice of the event nobody chose to publish.
  Both remain in the management payload.
- **Grid data is served with an `ETag`, and an unchanged poll is a bodyless
  304.** The phone app already sends `If-None-Match` and keeps an etag per
  cached day. This saves bandwidth only — the payload is still built in order
  to be hashed.

### Added
- `scripts/verify.py` — browser checks for the three behaviours above, asserted
  numerically. The drag is dispatched as real `DragEvent`s sharing one
  `DataTransfer`: Playwright's own drag helpers send mouse events, which do not
  produce an HTML5 drag, so the handlers never fire and everything passes for
  the wrong reason.
- **Working hours and the slot size are edited from the management toolbar.**
  `day_start_time`, `day_end_time` and `slot_minutes` have been event settings
  all along — the grid greys the hours outside them and refuses drops there —
  but nothing could change them, so every event was stuck on 09:00–18:00 in
  30-minute slots. The settings endpoint now accepts all three, and the
  toolbar edits them beside the other grid settings. The pair is validated
  together server-side, so updating one bound can never invert the window.
- **The management grid opens on the working-hours window, not the whole
  day.** At the defaults, midnight-to-midnight is 48 rows of which only 18
  accept drops, and every session began with a half-screen scroll past dead
  rows. The grid now renders the working hours plus one slot either side,
  widening on its own to keep anything scheduled outside them visible and
  reachable — and a "Full day" toolbar toggle restores the whole day.
- **A refused drop says why.** Dropping outside working hours or onto an
  overlap used to bounce the block back to where it started, silently. The
  cursor-following ghost now turns red the moment the position under it would
  be refused, with the reason captioned under the time preview, and a
  completed drop that is refused raises a banner naming the rule it hit —
  which times out on its own, so a stale reason does not outlive the mistake
  it explains.
- **The unscheduled panel can be searched, and follows the track filter.**
  Finding one talk in a 200-item scrolling column is the panel's whole job, so
  it gets a text filter over titles and speakers, and the toolbar's track
  filter now narrows it like it narrows the grid — dropping non-matching talks
  outright rather than greying them, since a greyed-out list is still a long
  list. (Room and group filters describe columns, and an unscheduled talk is
  in no column yet, so they do not apply here.)
- **Deleting a column, spanning block, session block or room group asks
  first.** None of these can be undone, and the column "×" in particular sat
  one stray click from a surface managers hit routinely to rename. The
  confirmation names what a confirming click costs — for a column, how many
  scheduled contributions move back to the unscheduled list — and
  click-to-rename now lives on the column title alone rather than the whole
  header.
- **The day is part of the URL**, on both grids. A shared link meaning
  "Wednesday's 9th floor" used to open on the default day with only the floor
  restored. The server still decides the actual day — an unknown one falls
  back to the default — so the URL follows what really loaded, and clearing
  the filters keeps it: it says which view is shown, not what is filtered out
  of it.
- **The printed sheet names its day and its filter.** Under the event title:
  the day (a stack of prints from a multi-day event was otherwise
  indistinguishable) and the active filter spelled out as "Rooms: …" /
  "Tracks: …" — which slice of the event a filtered sheet is, the sheet itself
  never said.

## [0.1.3+indico3.3.12] — 2026-08-18

### Added
- **The event's own logo in the grid-data payload** (`event_logo_url`), taken
  from Indico's Layout page. Nothing in the schedule uses it; it is there so the
  phone app can show each event's logo in its library, which it has no other way
  to learn. The address core serves it at contains the image's hash, so a
  replaced logo is a different URL and no cached copy anywhere can go stale.
  Null when no logo is set, rather than an empty string.
- **A Block Schedule switch on each event's Features page.** The plugin is no
  longer simply present in every event on the site: a manager turns it on for
  the events that want a grid, and events that do not want one are not offered
  it. It is off by default, except for events that already have a grid built —
  those keep it, so installing this version does not take working schedules off
  their menus. With the switch off, both menu entries disappear and every URL
  the plugin owns returns 404.
- **An administrator setting for that default** at Administration → Plugins →
  Block Schedule: "Enabled by default" turns the feature on for events that have
  not been decided either way. As in the rest of Indico, the default stops
  applying to an event the moment any feature is switched on or off there.
- **Track colours**, set on a page of their own reached from the management
  toolbar. Instead of every track sharing one purple pill, each track's badge
  carries its own colour — on the management grid, in the unscheduled panel and
  on the display page alike — which is what makes a colour-coded printed
  programme possible. Tracks left alone keep the default.

### Changed
- Badge and header text colours are now computed from the **WCAG contrast
  ratio** rather than from a rough brightness average, and the dark option is
  true black. Choosing the better of black and white can never fall below
  4.58:1, so there is no colour a manager can pick that produces a badge failing
  AA — the track-colour page shows the ratio each track actually achieved.

## [0.1.2+indico3.3.12] — 2026-08-15

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
