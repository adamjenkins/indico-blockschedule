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
  contributions while dimming the rest.
- Both the management and display grids have a fullscreen toggle.

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

Once running, every event gets a new "Block Schedule" entry in both its
management sidemenu and its public navigation menu. Room Booking does not
need to be enabled — columns can be created with just a name.

To upgrade later, repeat from step 1 (`git pull` instead of `git clone`),
then steps 3, 5 (if there's a new migration), 6, and 7.

## Development

```bash
pip install -e .
npm ci
python ../indico/bin/maintenance/build-assets.py plugin .
```

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
- If you've added a new client-side import, webpack may have split a
  shared `common.js`/`common.css` chunk out of the `management`/`display`
  bundles (check `manifest.json` for a `common.js` key) — both `views.py`
  WP classes already include it automatically when present, so a missing
  *new* error after adding an import most likely means that import itself
  is the problem: anything from `indico/react/*` or
  `indico/web/client/js/*` that ISN'T listed in `plugin.webpack.config.mjs`'s
  `externals` gets fully re-bundled, which can re-execute code (e.g.
  custom element registrations) that core's own page scripts already ran,
  crashing with errors like `Uncaught NotSupportedError: ... has already
  been used` and aborting before anything renders. Prefer reimplementing
  the small piece you need over importing one of those barrels.
