# 5. Placing talks on the grid

## The basic move

**Drag a contribution from the unscheduled panel onto a column.** Drop it where
you want it to start. That is scheduling.

**Drag a block already on the grid** to move it — to a different time, a
different column, or both. Same gesture, same rules.

While you drag, a ghost of the block follows the cursor and tells you the exact
time it would land on, updating as you move. **The ghost turns red over a
position that would be refused**, so you find out before you let go.

## Removing a talk from the grid

Either click the **✕** in a block's top-right corner, or **drag the block back
onto the unscheduled contributions panel** — the panel is a drop target, and
dropping a talk there does exactly what the ✕ does. The talk returns to the
panel.

The contribution is not deleted: its title, abstract, speakers and track are
untouched. Two things do not survive the round trip, though:

- **its Indico session** — see the last section of this chapter;
- **its room** — scheduling wrote the column's label onto the contribution as
  its room, and taking it off the grid does not put back whatever was there
  before. The talk keeps the room name until it is placed somewhere else.

## The two rules

Only two things can refuse a drop, and a refusal always names itself in a
banner over the grid rather than silently bouncing the block back.

### Outside working hours (09:00–18:00)

The **whole** block must fit between **Day starts** and **Day ends**. A
45-minute talk cannot start at 17:30 if the day ends at 18:00.

Widen the window in the toolbar if you genuinely need the time.

> This rule does not relax when **Full day** is on. Full day changes what the
> grid *draws*, not where you may *drop* — see below.

### Overlaps another contribution

Two contributions can never share the same column at overlapping times. This
holds however they got there, including through Autoschedule.

If you want to swap two talks, take one off the grid first, move the other,
then put the first one back.

## Working hours and Full day

**Day starts** and **Day ends** set the window the grid draws.

The management grid normally shows just that window — plus anything already
scheduled outside it, which stays visible and reachable rather than vanishing.
Turning **Full day** on shows the whole midnight-to-midnight day instead.

You do not need Full day to *see* something placed outside the window: the
management grid stretches its window to cover anything already placed, precisely
so that nothing becomes unreachable. Full day is for looking at the rest of the
day — the empty hours either side.

Either way, you still cannot *drop* outside the window. To move an out-of-hours
talk somewhere else out of hours, widen **Day starts** / **Day ends** first.

## Snap to

**Snap to (min, 0 = off)** rounds where a dragged block lands. With the default
of 5, a drop is rounded to the nearest five minutes, so a day of talks lines up
even though you are aiming with a mouse.

Set it to 0 to place things to the exact minute.

## GapSnap

**Gap after contributions (min)** is the changeover time you want left after
every talk — five minutes to swap laptops, fifteen to move rooms.

Set it to anything above 0 and dragging becomes magnetic: when you release a
block **within one slot** of the right distance from a neighbour, it snaps
exactly to that neighbour's edge plus the gap. It works in both directions —
before a neighbour as well as after it.

So with a 10-minute gap, dropping a talk roughly after one that ends at 10:30
lands it at exactly 10:40, not 10:38.

Set the gap to 0 and this is off; only **Snap to** rounding applies.

## What happens in the rest of Indico

Placing a talk here writes a real entry into Indico's own timetable, so the
built-in **Timetable** page, the exports and the API all agree with the grid.

Two consequences worth knowing:

- The **room** recorded on the contribution becomes the **column label** you
  typed.
- **Scheduling a talk clears its Session field.** This one surprises people, so
  it is worth reading twice.

  Indico only allows a session's contributions to be scheduled *inside* a
  session block, which would tie every talk's placement to its session and
  defeat the point of a free grid. Block Schedule therefore takes a note of the
  talk's session, clears the field, and places the talk as a plain top-level
  entry.

  What you see afterwards:

  - **on the grid** — the session badge is still there, from that note, and
    goes on being shown wherever the talk appears;
  - **under Organisation → Contributions** — the talk's **Session** column now
    reads *No session*;
  - **under Organisation → Sessions** — the session no longer lists it.

  The note lives on the placement, not on the talk, so it survives exactly as
  long as the talk stays on the grid. **Taking the talk off destroys it**:
  unschedule with **✕**, delete its column, or clear the timespan with
  Autoschedule, and the talk returns to the panel with no session at all — no
  badge, and nothing to restore it but re-assigning it by hand under
  **Organisation → Contributions**.

  Nothing about the schedule goes wrong and the badge is never misleading while
  the talk is on the grid, but do not go looking for your sessions in Indico's
  own session pages once you have scheduled here. If you want a session to read
  as a group on the page, draw a **session block** banner over it (chapter 7).
