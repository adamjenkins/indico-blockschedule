# 14. If something looks wrong

## There is no "Block Schedule" in the menu

The feature is off for this event. **Advanced options → Features** — see
chapter 2. If you cannot see the Features page at all, you are not a manager of
the event.

## The grid is empty

A new event has no columns. Add one with **Column** in the add bar (chapter 4).
An empty grid before that point is normal, not a broken installation.

## A talk will not drop where I want it

Two rules, and the ghost turns red before you let go:

- **Outside working hours** — the whole block must fit between **Day starts**
  and **Day ends**. Widen them in the toolbar.
- **Overlaps another contribution** — something is already there in that
  column. Move the other one first, or use a different column.

A refused drop always names its reason in a banner. If nothing happens at all
and no banner appears, you released the block outside any column.

## I cannot move a talk that is already outside working hours

You can already see it: the management grid stretches its window to cover
anything placed outside the working hours, so it never becomes unreachable.

What stops you is the drop rule, which **Full day does not relax**. To move it
somewhere else outside the working hours, first widen **Day starts** /
**Day ends**.

## A contribution is not in the unscheduled panel

Three possibilities, in order of likelihood:

1. **It is already scheduled** — look on the grid, or check another day.
2. **A filter is hiding it.** If the panel says *No unscheduled contributions
   match the current filters*, clear the track filter and the search box. If it
   says *All contributions are scheduled*, there genuinely is nothing left.
3. **It does not exist yet.** Block Schedule never creates contributions —
   create it under **Organisation → Contributions**.

## A talk scheduled in Indico's own Timetable never appears here

The unscheduled panel holds only contributions with **no timetable entry at
all**. A talk already scheduled in Indico's built-in Timetable has one, but no
Block Schedule column — so it is in neither the panel nor the grid, and
Autoschedule will not touch it. Unschedule it in the built-in Timetable and it
appears here.

## The contributions list says "No session" for talks that clearly have one

That is expected, and it is explained in chapter 5. Placing a talk on this grid
clears its Indico **Session** field, because Indico would otherwise insist the
talk be scheduled inside a session block. The grid keeps its own note of the
session and goes on showing the badge, so nothing on the schedule is wrong —
but Indico's Contributions and Sessions pages will no longer show the link.

## A talk lost its session badge when I took it off the grid

Expected, and irreversible from here. The session badge on a scheduled talk
comes from a note the grid keeps on the *placement*; unscheduling the talk,
deleting its column or clearing its timespan removes the placement and the note
with it. Re-assign the session under **Organisation → Contributions**.

This is also why clearing a timespan and re-running Autoschedule does not
reproduce the first result: those talks are no longer grouped as a session.

## A block is the wrong height

Block height is always proportional to the contribution's **duration**, and
nothing on this page overrides it. If a block looks wrong, the duration is
wrong. Fix it under **Organisation → Contributions**.

## A talk's page shows the wrong room

The room on a scheduled contribution is the **column label** you typed, not a
room-booking record. Rename the column by clicking its title.

The grid, the display page and the exports update at once. Talks that were
already scheduled keep the old label on their own Indico contribution pages
until they are moved again — drag them once, or unschedule and re-place them,
if that matters.

## The track colours page says there are no tracks

Tracks are an Indico feature. Create them under **Organisation → Programme**,
then come back.

## Autoschedule will not run

- **No columns.** Add at least one.
- **The range is entirely outside working hours.** Autoschedule only fills the
  **Day starts**–**Day ends** window of each day, so a request from 19:00 to
  22:00 against a 09:00–18:00 day has nowhere to put anything.
- **The end is not after the start.** Check the day *and* the time on both rows.

## Autoschedule left talks over

It reports the titles it could not fit. Widen the range, add a column, shorten
something, or place those talks by hand.

## Autoschedule gave me a different answer than last time

That is deliberate — the order in which talks get first pick is randomised on
every run (chapter 6). The grouping rules always hold, but the arrangement will
not repeat. If you like a layout, stop running it.

## Autoschedule put a talk on top of the lunch break

Autoschedule looks at talks and nothing else; spanning blocks and session blocks
are not obstacles to it (chapter 6). Either autoschedule first and draw the
banners afterwards, or run it in ranges that stop at the break.

## Printing includes the Indico header and menus

Use the **Print…** button on the display page rather than the browser's own
print command. The plugin's own printing hides the site around the grid and adds
a header with the event, the day and the active filter.

## The printed sheet is unreadable in black and white

Turn **Black and white** on *before* printing, and look at the result on screen.
It applies the same greyscale conversion the printer will, so it shows you which
colours collapse into each other. The fix is then to change those track colours
(chapter 8) — the toggle only shows you the problem.

## Attendees say they cannot see a talk

The display page shows each viewer only what they are allowed to see. A
contribution protected inside a public event is invisible to people without
access — on the page, in the exports and in the phone app. Check the
contribution's own protection settings.

## Attendees say there is no star on the blocks

The star and the **Highlight my timetable** toggle are drawn only for signed-in
viewers. Anyone browsing anonymously sees neither. They have to log in first.

## The day I want is not in the date dropdown

The dropdown offers the event's own days. Change the event's start and end dates
under **Settings**.

## I turned the feature off and my schedule vanished

Nothing was deleted. Turn it back on and the grid is exactly as you left it —
columns, placements, groups, banners and track colours all intact.
