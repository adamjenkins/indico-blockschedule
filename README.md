# indico-plugin-blockschedule

A simpler, grid-based alternative timetable for Indico events: time runs
down the rows, rooms run across the columns.

- Event managers schedule contributions by dragging them from an
  "unscheduled" panel onto the grid, and reschedule them later the same
  way. Block height is proportional to each contribution's actual
  duration, and every block shows its start–end time in the bottom-right
  corner.
- Columns work whether or not the Room Booking module is enabled: if it
  is, a column can optionally be linked to an existing room (used only to
  prefill its name); either way every column has its own editable text
  label, and that's what's shown as the column header and on a scheduled
  contribution's own page — not the official room name.
- A star icon on every block lets anyone favourite/unfavourite the
  contribution directly from the grid, without visiting the contribution
  page (this is the same "add to my timetable" favorite used elsewhere in
  Indico).
- The public display page links each scheduled block straight to its
  contribution page, and has a toggle to highlight the viewer's starred
  contributions while dimming the rest. It shows only the contributions the
  viewer is allowed to see: a talk protected inside a public event is absent
  from the grid, from the data the phone app caches, and from the public
  spreadsheet exports.
- Rooms can be gathered into named groups (by floor, building, or any other
  useful set), and a room can be in several groups at once. Both grids can then
  be narrowed to any combination of groups, individual rooms, and tracks — which
  is what makes a 30-room schedule printable, one floor or one track at a time.
  Tracks are offered as groups automatically. Filtering by track keeps the rooms
  that host those talks and greys out the rest of each room's programme, so the
  sheet still shows when a room is busy. The current filter lives in the URL, so
  a particular view can be bookmarked, shared, or reprinted exactly.
- Both the management and display grids have a fullscreen toggle.
- Columns can be themed with a color (saturated on the header, a pale
  tint across the column body) and reordered by dragging one column
  header onto another.
- "GapSnap": set a gap to leave after every contribution, and dragging a
  contribution near a neighbor snaps it to that gap automatically.
- Column-spanning blocks for things that apply to the whole conference
  at once (lunch breaks, plenary sessions) — a single bar drawn across
  every column for a given time range. Manually-placed "session block"
  banners work the same way but can span just some of the columns, and
  can be tied to a real session for their title/colour.
- The grid-data payload carries the **event's own logo** from Indico's Layout
  page. Nothing in the schedule itself uses it — it is published for the phone
  app, which shows each event's logo in its library and has no other way to
  learn it.
- Export the schedule as CSV, ODS, or Excel — the spreadsheet formats
  include a second sheet laid out like the visual grid itself, with one
  merged cell per presentation carrying its room, session, track,
  author(s), and date/time.
- Printing the display page (any of A4/A3/A2, portrait or landscape)
  shows just the grid and the event title, not the surrounding site
  chrome, and respects the page's own "Black and white" toggle.
- An autoscheduler fills a given timespan for you: it keeps a session's
  (or, failing that, a track's) contributions together and back-to-back
  in the same column, avoids parallel-scheduling the same session/track
  across different columns, places everything else wherever there's
  room, respects the GapSnap gap throughout, randomizes placement order
  on every run, can clear a timespan without immediately refilling it,
  and can exclude specific sessions/tracks from being touched at all.
- Configurable row height, snap-to-minutes, and per-column minimum width;
  session/track shown as pill badges (with a setting to hide them) and an
  optional description preview.
- Tracks can be given their own colours, on a settings page reached from the
  management toolbar. The track's badge then carries that colour everywhere it
  appears — the management grid, the unscheduled panel and the display page —
  so a colour-coded programme reads the same on screen and on paper. The badge's
  *text* colour is never chosen: it is computed as black or white, whichever
  contrasts better, which guarantees every badge clears the WCAG AA threshold
  (4.5:1) no matter what colour is picked. The settings page shows the ratio it
  achieved for each track.
- Presentation titles are truncated with an ellipsis after a set number of
  lines — three by default, changed per event from the management
  toolbar's "Title lines" box, or set to 0 for no limit. Long titles
  otherwise crowd out the speaker, badges and time inside a block. The
  full title is still there on hover, and the limit applies to the
  management grid too, so what you arrange is what gets printed.
- Contributions can never overlap in the same room/time, and dropping one
  outside the event's configured working hours (shown visibly greyed
  out) just bounces back instead of scheduling it. A live, cursor-
  following preview shows the time a dragged contribution would land on
  before you drop it.
- Sticky column headers and a sticky, scrollable unscheduled-
  contributions panel, both capped to the viewport height. On the display
  page a wide grid also gets a horizontal scrollbar pinned to the bottom
  of the window: the grid's own one sits at the foot of a table that is
  usually several screens tall, so it is off-screen exactly when it is
  needed.
- The controls for adding columns, spanning blocks and session blocks sit
  at the top of the management workspace, one open at a time, so they are
  reachable without scrolling past the whole day first.

Block Schedule is added alongside Indico's built-in Timetable feature, not
a replacement for it — both stay usable, and scheduling writes into
Indico's real `TimetableEntry` data, so the API, exports, and the core
timetable stay in sync with what's shown here.

## Installation

This plugin isn't published to PyPI yet, so it's installed from a clone of
this repository. These steps assume Indico itself is already installed
and running somewhere, and that you have shell access to the same machine
and Python virtualenv Indico runs in (if you don't have an Indico instance
yet, see [Indico's own installation docs](https://docs.getindico.io/)
first).

1. **Clone this repository**, anywhere convenient — it doesn't need to
   live inside your Indico checkout:
   ```bash
   git clone <repository-url> blockschedule
   cd blockschedule
   ```
2. **Activate Indico's virtualenv** (the same one `indico` itself is
   installed in — adjust the path to wherever yours lives):
   ```bash
   source /path/to/indico/.venv/bin/activate
   ```
3. **Install the plugin package** in editable mode, from the clone:
   ```bash
   pip install -e .
   # (or, on a venv managed with uv: uv pip install -e .)
   ```
4. **Enable the plugin** by adding `blockschedule` to `PLUGINS` in your
   Indico config file (`indico.conf`) — keep any plugins already listed:
   ```python
   PLUGINS = {'blockschedule'}
   ```
5. **Apply its database migration**:
   ```bash
   indico db --plugin blockschedule upgrade
   ```
6. **Build the frontend assets.** This needs Node.js/npm and your Indico
   *core source checkout* (not just the installed package) — run it from
   inside that checkout, pointing at the plugin clone from step 1:
   ```bash
   cd /path/to/indico-core-checkout
   python bin/maintenance/build-assets.py plugin /path/to/blockschedule
   ```
   This installs the plugin's npm dependencies automatically on first run.
7. **Restart Indico** so it picks up the newly enabled plugin and the
   built assets — e.g. `sudo systemctl restart <your-indico-service>`, or
   just stop/restart `indico run` if you're running it directly.

Once running, Block Schedule appears as a switch on each event's
**Features** page. It is **off by default**, with one exception: an event that
already has a block-schedule grid keeps it, so upgrading an existing site does
not take working schedules off their event menus. Turning the switch on gives
that event a "Block Schedule" entry in both its management sidemenu and its
public navigation menu; turning it off hides both and makes the plugin's URLs
return 404.

Site administrators can change the default for new events at
**Administration → Plugins → Block Schedule**, by turning on "Enabled by
default". Note the semantics this inherits from Indico: the default applies only
to events where no feature has ever been switched on or off. Once an event's
feature list has been touched at all, that event keeps whatever it was set to.

Room Booking does not need to be enabled — columns can be created with just a
name.

To upgrade later, repeat from step 1 (`git pull` instead of `git clone`),
then steps 3, 5 (if there's a new migration), 6, and 7.

## Development

```bash
pip install -e .
npm ci
python ../indico/bin/maintenance/build-assets.py plugin .
```

`eslint`/`tsc` need a real Indico checkout too — `tsconfig.json` resolves
it as `./indico-src` (a symlink to your real checkout works fine), and
`.eslintrc.js` reads its path from an `.indico_source` file (plain text,
the absolute path on one line) if present, falling back to introspecting
the `indico` Python package otherwise. Keep both pointed at the same
*nested* `./indico-src` location, not an arbitrary path elsewhere — CI
checks out Indico into `./indico-src` for exactly this reason, and an
ESLint resolver quirk around the `import/order` rule sorts the `indico/*`
aliased imports differently depending on whether the target is reachable
as a subdirectory of the project being linted or not:
```bash
ln -s /path/to/your/indico/checkout indico-src
echo "$(pwd)/indico-src" > .indico_source
```
Both `indico-src` and `.indico_source` are gitignored — never commit them.

See `TASKLIST.md` for the build plan, and `dev-env/` for a one-command
local Postgres + redis setup (via podman) for manual click-through
testing — `dev-env/README.md` covers that in detail, and
`dev-env/setup-instance.sh` automates the whole loop (venv, Indico +
plugin install, asset build, a systemd unit, and an optional nginx
location) end to end.

### Running the test suite

```bash
pytest
```
Needs Postgres reachable via `INDICO_TEST_DATABASE_URI` and a
`redis-server` binary on `PATH` (see `dev-env/`); see
`.prompts/core/ci-validation.md` in the wider `indipda` toolset this
plugin was scaffolded from for the full checklist (ruff/isort/unbehead/
eslint/stylelint) if you have it checked out alongside this repo.

### Troubleshooting

**The Block Schedule page loads but shows nothing.** This is almost
always a frontend asset problem, not a backend one — check your browser's
JS console first. The two most likely causes if you're developing against
this plugin (not just installing it):
- The asset build didn't actually run, or ran against a stale install —
  re-run step 6 of [Installation](#installation) and confirm
  `indico_blockschedule/static/dist/manifest.json` was just regenerated.
- If you've added a new client-side import, double-check it against
  `plugin.webpack.config.mjs`'s `externals`: anything from
  `indico/react/*` or `indico/web/client/js/*` that ISN'T listed there
  gets fully re-bundled, which can re-execute code (e.g. custom element
  registrations) that core's own page scripts already ran, crashing with
  errors like `Uncaught NotSupportedError: ... has already been used`
  and aborting before anything renders. Prefer reimplementing the small
  piece you need over importing one of those barrels.
- This plugin's own `webpack.config.mjs` disables webpack's automatic
  `common`-chunk splitting between the `management`/`display` bundles
  (see the comment in that file). That's a deliberate workaround, not
  something to "fix" — plugin builds don't get a shared runtime chunk
  (`runtimeChunk: false` in core's `webpack/base.mjs`), so a chunk
  shared between two entries with different runtimes can end up
  executing under the wrong one, observed as `__webpack_require__.nmd is
  not a function`. If you see that error, you've likely re-introduced a
  module shared between `client/management/` and `client/display/`
  outside of that file — keep shared code small enough that webpack
  doesn't try to split it out, or duplicate it instead.
