# TASKLIST — Block Schedule, round 6

Three changes, all landing on **both** branches (`main` and
`release/indico-3.3.12`), plus a follow-on in the phone app
(`../indico-schedule-app/`), which is a separate deliverable and not part of
either branch.

Phases 1 and 2 are independent. Phase 3 depends on phase 2 having put a
colour into the grid-data payload, so it is ordered last.

## Phase 1 — An event feature switch

- [x] `BlockScheduleFeature`, registered through
      `signals.event.get_feature_definitions`, so the plugin appears as a
      switch on each event's **Features** page like registration, surveys and
      the rest.
- [x] Off by default, with one deliberate exception: an event that **already
      has block-schedule columns** defaults to on. Without that, updating the
      plugin would take every schedule already built off its event menu until
      someone went and found the switch.
- [x] Admin setting `enabled_by_default` at `/admin/plugins/` flips the
      default for events that have not been decided either way. Note the core
      semantics this inherits: once *any* feature has been toggled on an
      event, that event has an explicit feature list and no default — ours or
      anyone's — applies to it again.
- [x] The blueprint carries `event_feature='blockschedule'`, so every URL the
      plugin owns 404s when the switch is off. Belt and braces alongside the
      menu entries, which is what a manager actually sees.
- [x] Both menu entries respect it: the management side-menu item checks the
      feature, and the display entry uses `MenuEntryData(visible=…)` rather
      than being withheld from the signal — an entry withheld from the signal
      is an entry core deletes from the event's layout menu.

## Phase 2 — Track colours

- [x] A **settings page of its own** at
      `…/manage/block-schedule/track-colors`, reached from a link in the
      management toolbar. Track colours are set-once configuration; the grid
      toolbar is already carrying eight controls.
- [x] Stored as a per-event plugin setting `track_colors` — a map of track id
      to `rrggbb`. Core's `Track` model has no colour column and this plugin
      does not migrate core tables, so the colour is the plugin's to keep.
- [x] Each track's colour published in the grid-data payload
      (`tracks[].color`, `null` when unset), so the display page, the
      management grid and the phone app all read one source.
- [x] The pill badge on a contribution block takes its track's colour, on
      both grids and in the unscheduled panel. Tracks with no colour set keep
      today's purple.
- [x] Text colour on the pill is **computed, not chosen**: black or white,
      whichever gives the higher WCAG contrast ratio against the manager's
      colour. Picking the better of those two can never fall below 4.58:1,
      which clears AA (4.5:1) for every colour on the wheel — so there is no
      colour a manager can pick that produces an unreadable badge.
- [x] The settings page shows the achieved ratio next to each track, so the
      guarantee is visible rather than merely claimed.
- [x] Reset-to-default per track, and a palette of suggested colours so
      setting up ten tracks is not ten trips through the colour picker.

## Phase 3 — The phone app (`../indico-schedule-app/`)

- [x] **Clashes drawn as a group.** Starred talks that overlap are wrapped in
      one bordered box headed `⚠ Clash · 14:00–14:30 · 2 talks at once`,
      instead of each carrying a `· clashes` suffix in its time pill. The
      point of the feature is knowing *which* talks collide; a suffix on two
      rows twelve rows apart does not say that.
- [x] Clusters are transitive: A overlapping B and B overlapping C puts all
      three in one box even when A and C do not touch.
- [x] **Real track colours.** The app's track stripe and track pill take the
      manager's colour from `tracks[].color`, falling back to the generated
      palette for tracks with no colour set — so the phone and the printed
      grid agree.
- [x] Same contrast rule as the plugin, in the app's own copy.

## Verification

Done against the live 3.3.12 instance: **17 plugin checks and 15 app checks
pass**, plus 43 pytest tests.

- [x] Features page shows the switch; turning it off removes both menu
      entries and 404s the URLs; turning it back on restores them.
- [x] A fresh event defaults off; an event with columns defaults on; the
      admin setting flips the fresh event's default.
- [x] Track colours survive a reload, reach the display page and the
      management grid, and the computed text colour is the higher-contrast of
      black and white -- checked with a dark red (white text) and a pale yellow
      (black text), and with the worst ratio on a full page of tracks asserted
      to clear 4.5:1.
- [x] App: the clashing pair is boxed and holds exactly those talks; finished
      talks are hidden with the count on the button, come back dimmed when
      shown, and hide again; track colours match the plugin's.

Not done on `main`: it targets Indico 3.3.13+ and cannot be exercised on this
3.3.12 instance, so the port carries the same code but not the same evidence.
