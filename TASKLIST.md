# TASKLIST — Block Schedule plugin

A simpler, grid-based alternative timetable for Indico events: time down the
rows, rooms across the columns, drag-and-drop scheduling on the management
side, a read-only linked grid on the public display side, and a "highlight
my timetable" toggle. Added alongside the core Timetable feature, not a
replacement for it. Schedules write into Indico's real `TimetableEntry`/
`Contribution.room` data so the rest of Indico stays in sync.

## Phase 1 — Scaffold

- [ ] `indico_blockschedule/plugin.py` — `BlockschedulePlugin(IndicoPlugin)`
- [ ] `indico_blockschedule/blueprint.py` — management + display URL groups
- [ ] `indico_blockschedule/settings.py` — `EventSettingsProxy` (slot
      minutes, day start/end)
- [ ] `pytest.ini` (`indico_plugins = blockschedule`,
      `python_files = *_test.py`)
- [ ] `ruff.toml` (copied from a reference plugin)
- [ ] `.npmrc`, `package.json` (copied/adapted from `vc_zoom`)

## Phase 2 — Model + migration

- [ ] `indico_blockschedule/models/columns.py` — `BlockScheduleColumn`
      (schema `plugin_blockschedule`: event_id, room_id, position, label)
- [ ] Alembic migration creating the schema + `columns` table
- [ ] Verify upgrade/downgrade both run cleanly

## Phase 3 — Backend REST + serialization

- [ ] `indico_blockschedule/util.py` — column/contribution serialization
      helpers (speakers/authors, title, room, `is_starred`, locator/URL)
- [ ] `indico_blockschedule/controllers.py`:
  - [ ] `RHManageBlockSchedule` (page shell + grid data)
  - [ ] Column CRUD (`POST`/`PATCH`/`DELETE`)
  - [ ] `POST .../schedule` (create/update `TimetableEntry` + room)
  - [ ] `POST .../unschedule` (remove `TimetableEntry`)
  - [ ] `RHDisplayBlockSchedule` (read-only grid data)
- [ ] Unit tests for serialization + scheduling logic

## Phase 4 — Management page wiring

- [ ] Sidemenu entry under `event-management-sidemenu`
- [ ] `views.py` WP class (`WPManageBlockSchedule`), template shell renders
- [ ] Confirm routes resolve end-to-end (no JS yet)

## Phase 5 — Management React app

- [ ] `client/management/index.js` entry
- [ ] `BlockScheduleApp.tsx` — data fetching/state/API calls
- [ ] `ScheduleGrid.tsx` — time-slot rows x room columns, drop targets,
      inline-editable column headers
- [ ] `UnscheduledPanel.tsx` — draggable unscheduled contribution list
- [ ] `ContributionBlock.tsx` — shared block renderer (speakers + title)

## Phase 6 — Public display page

- [ ] Sidemenu entry via `signals.event.sidemenu` / `MenuEntryData`
- [ ] `views.py` WP class (`WPDisplayBlockSchedule`)
- [ ] `client/display/index.js` entry
- [ ] `BlockScheduleDisplay.tsx` — read-only grid, blocks link to
      contribution page
- [ ] "Highlight my timetable" toggle (client-side, driven by `is_starred`)

## Phase 7 — Styling + multi-day

- [ ] SCSS modules for both surfaces (grid lines, block colors, dimmed state)
- [ ] Day selector for multi-day events (management + display)

## Phase 8 — CI

- [ ] `.github/workflows/ci.yml` — lint (ruff/isort/unbehead), pytest with
      Postgres+redis services, eslint/stylelint, webpack build

## Phase 9 — Validation

- [ ] `ruff check .`, `isort --check-only .`, `unbehead --check`, `pytest`
- [ ] `eslint`, `stylelint`, `webpack` build producing `static/dist/manifest.json`
- [ ] Manual click-through on `https://vagrant.wisecat.net/`: column
      edit/persist, schedule/reschedule/unschedule via drag-and-drop,
      display links to contribution pages, starred-highlight toggle,
      multi-day day switching
