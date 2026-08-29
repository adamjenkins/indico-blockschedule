# 1. Introduction

Block Schedule is an Indico plugin that gives your event a second, grid-shaped
timetable. **Time runs down the rows; rooms run across the columns.** It is the
shape most conference programmes are printed in, and it is the shape most
committees think in when they argue about what clashes with what.

![The management page](../images/en/02-management-page.png)

## What it is for

You use Block Schedule when you have to place a lot of talks into a lot of
rooms and see the whole day at once. Its three working parts are:

- the **grid** itself — one column per room, one row per time slot;
- the **unscheduled contributions** panel beside it, holding every talk that
  has no time yet — see the warning below;
- a **display page** your attendees see, which is the same grid without the
  editing controls.

You drag a talk from the panel onto the grid to schedule it, and drag it around
the grid to move it. That is the whole of the core interaction.

## How it relates to Indico's own Timetable

Block Schedule is **added alongside** Indico's built-in Timetable, not in place
of it. Both stay usable, and they are not two separate copies of your
programme: scheduling a talk here writes a real entry into Indico's own
timetable data.

That means:

- a talk you place on the grid appears in the built-in **Timetable** too;
- the event's exports, its API and its public timetable page all stay in step;
- the room shown on a talk's own page is the **column label** you typed, not a
  room-booking record.

> **Build the programme in one place.** The unscheduled panel holds
> contributions that have **no timetable entry at all**. A talk that somebody
> has already scheduled in Indico's built-in Timetable therefore appears
> *neither* in the panel *nor* on this grid, and Autoschedule will not pick it
> up either — it is simply invisible here until it is unscheduled in the
> Timetable. Decide which of the two timetables owns your programme before you
> start.

You can therefore build the programme here and let everything else in Indico
carry on as normal. What you cannot do is expect the built-in Timetable's own
session-block structure to appear on this grid — Block Schedule deliberately
places talks as plain top-level entries, and draws its own banners instead
(see chapter 7).

## What this manual covers

This manual is written for **conference managers**: the people who build and
publish an event's programme. It assumes you can already reach your event's
management area in Indico and that somebody has installed the plugin on your
site.

It does not cover installing or configuring the plugin at the server level, and
it is not a guide for attendees.

## A note on wording

Indico's own vocabulary is used throughout, because that is what the buttons
say. In particular:

| Word | What it means here |
|---|---|
| **Contribution** | One talk, poster or presentation. Indico's word for it; the plugin's panel is called *Unscheduled contributions*. |
| **Track** | A thematic strand of the programme, set up under **Organisation → Programme**. |
| **Session** | An Indico session a contribution belongs to. |
| **Column** | One vertical division of the grid. In practice a room, but the plugin never insists on that. |
| **Spanning block** | A bar drawn across *every* column — a lunch break, a plenary. |
| **Session block** | A banner drawn across *some* columns, optionally tied to a real session. |

Chapter 15 has the full glossary, including the Japanese term used for each.
