# Indico 3.3.12 compatibility — what was removed

This branch (`release/indico-3.3.12`) is the `main` feature set with
**contribution favouriting removed**, so the plugin runs on Indico 3.3.12.
Everything else — drag-and-drop scheduling, columns and theming, the
autoscheduler, spanning/session blocks, printing, spreadsheet export, the
fullscreen toggles and the public display grid — is unchanged.

## Why it had to go

Favouriting was built against `User.favorite_contributions`, which core
added **after** 3.3.12 (3.3.12 only has `favorite_events`). On 3.3.12 it
broke in two separate places:

1. **At runtime** — `serialize_contribution()` raised
   `AttributeError: 'User' object has no attribute 'favorite_contributions'`,
   so the grid-data endpoint returned a 500 and neither grid rendered.
2. **At asset-build time** — `FavoriteStar.tsx` imported
   `indico-url:contributions.favorite_contributions_api`. That endpoint does
   not exist in 3.3.12, so it is absent from the `url_map.json` generated
   from the running app and the import cannot resolve. The webpack build
   fails before it can produce a bundle.

The second one is why disabling the feature at runtime would not have been
enough — the code had to come out of the client bundle.

## What was removed

| Area | Change |
|---|---|
| `indico_blockschedule/util.py` | Dropped the `is_starred` key from `serialize_contribution()`, and its now-unused `user` parameter |
| `indico_blockschedule/controllers.py` | Stopped threading `session.user` into `serialize_contribution()` / `_grid_payload()`; dropped the resulting unused `flask.session` import |
| `indico_blockschedule/client/FavoriteStar.tsx`, `FavoriteStar.module.scss` | Deleted |
| `indico_blockschedule/client/ContributionBlock.tsx` | Removed the star, the `starred` state, and the `showFavorite`/`highlightStarred` props (with them the `dimmed`/`starred` styling and the now-unused `eventId` prop) |
| `indico_blockschedule/client/ContributionBlock.module.scss` | Removed the `.dimmed` and `.starred` rules |
| `indico_blockschedule/client/display/DisplayApp.tsx` | Removed the "Highlight my timetable" toggle and the `loggedIn` prop, which existed only to gate favouriting UI |
| `indico_blockschedule/client/management/{ScheduleGrid,UnscheduledPanel,ManageApp}.tsx` | Dropped the `eventId` prop that only the star used |
| `indico_blockschedule/client/types.ts` | Removed `is_starred` from `BSContribution` |
| `indico_blockschedule/templates/display.html` | Dropped the `logged-in` attribute |
| `tests/util_test.py` | Removed the two `is_starred` tests; kept a plain serializer test so the field-level coverage isn't lost |

No database models, migrations or plugin settings were involved — favouriting
reused Indico's own favourites, so there is no plugin state to clean up and
no migration to run when moving between this branch and `main`.

## For users on Indico 3.3.13+

Use `main`, which has favouriting. Nothing in this branch needs to be undone
first: because the feature stored no plugin-side state, switching branches and
rebuilding assets is enough.

## Maintaining this branch

`main` is the development branch; this one is a port target. When merging
`main` into it, expect conflicts only in the files listed above, and re-check
that no newly-added code calls a core API introduced after 3.3.12 — the
dependency pin is `indico>=3.3` on both branches, so packaging will not catch
it for you.

This branch's version carries a local marker, `0.1.0+indico3.3.12`, so that the
wheel built from it (`indico_plugin_blockschedule-0.1.0+indico3.3.12-py3-none-any.whl`)
is distinguishable from `main`'s after download and in `pip show`. Compiled
assets are specific to the Indico version they were built against, so an
unlabelled wheel is a genuine hazard. Keep the marker when bumping the numeric
part in step with `main`.
