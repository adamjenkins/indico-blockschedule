# TASKLIST — Block Schedule, round 5

Three usability fixes, all landing on **both** branches (`main` and
`release/indico-3.3.12`). They are independent of each other; the title
limit is ordered last because it is the only one that touches the payload
and so the only one with a settings/type change to carry.

## Phase 1 — A scrollbar you can actually reach (display page)

- [x] New `display/StickyScrollbar.tsx`: a horizontal scrollbar fixed to
      the bottom of the window, shown only while the grid overflows
      sideways, part of it is on screen, and its own scrollbar is not
      (which also covers fullscreen, where the grid fits the window).
- [x] Rendered through a portal into `<body>`. The "Black and white"
      toggle is a CSS `filter`, and a filtered ancestor becomes the
      containing block for `position: fixed` descendants — in place, the
      bar would be pinned to the bottom of the *grid*, which is the exact
      problem being fixed.
- [x] Track and thumb drawn rather than delegated to a real overflowing
      element: native scrollbars cannot be relied on to be *visible*
      (overlay scrollbars occupy no space and fade out when idle, and
      Chrome ignores `::-webkit-scrollbar` once `scrollbar-width` is set).
      Verified: the first, native implementation rendered as a blank strip
      in a real browser.
- [x] Drag the thumb, or click the bare track to jump; position follows
      the grid when it is scrolled by any other means.
- [x] Hidden when printing, and free of charge in fullscreen (the portal
      is outside the fullscreen subtree).

## Phase 2 — Add controls at the top of the workspace (management page)

- [x] The "add column", "add spanning block" and "add session block" forms
      move above the column headers, from below the grid.
- [x] Collapsed behind a row of three buttons, one open at a time —
      three permanently expanded forms would push the grid itself
      off-screen, which is the same problem in a different place.
- [x] Open form framed so it reads as a panel rather than as loose
      controls floating above the grid.

## Phase 3 — Title line limit

- [x] `title_max_lines` event setting, default 3, `0` meaning no limit;
      exposed in the grid payload and validated (0–20) in
      `RHSettingsUpdate`.
- [x] `ContributionBlock` clamps the title to that many lines with an
      ellipsis, and carries the full text as a `title` tooltip when it
      does. No clamp, and no tooltip, at 0.
- [x] Applied on the display page **and** the management grid, so what is
      arranged is what gets printed. Deliberately *not* applied in the
      unscheduled-contributions panel, which is where you hunt for a
      specific talk by name.
- [x] Manager-facing "Title lines (0 = no limit)" box in the management
      toolbar.
- [x] Payload contract tests in `tests/controllers_test.py`.

## Phase 4 — Validation

- [x] `pytest` (38), `ruff`, `isort`, `eslint`, `stylelint`, `tsc` clean.
- [x] Frontend rebuild, `indico-dev.service` restart.
- [x] Live browser verification against the 30-column / 200-contribution
      event and the three-day event, asserted numerically: 31 checks
      covering thumb geometry and both drag and click, the bar appearing
      and disappearing at the right scroll positions, clamped line counts
      and measured title heights at 3 / 1 / 0 lines, and the add panel's
      position and one-at-a-time behaviour.
- [x] Toolbar overlap regression caught by screenshot and fixed: both
      toolbars now wrap instead of compressing.
- [x] Clean up temporary verification scripts/screenshots before
      finishing.
