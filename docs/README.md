# docs — the manager's manual

User documentation for **conference managers**: the people who build and
publish an event's programme with Block Schedule. It does not cover installing
the plugin (see the repository `README.md`) and it is not written for
attendees.

| | |
|---|---|
| English | [`en/00-index.md`](en/00-index.md) · [`BlockSchedule-Manager-Manual-en.pdf`](BlockSchedule-Manager-Manual-en.pdf) |
| 日本語 | [`ja/00-index.md`](ja/00-index.md) · [`BlockSchedule-Manager-Manual-ja.pdf`](BlockSchedule-Manager-Manual-ja.pdf) |

## Layout

```
docs/
  en/                 15 chapters + an index, one Markdown file each
  ja/                 the same, in Japanese
  images/en/          screenshots of the English interface
  images/ja/          screenshots of the Japanese interface
  assets/manual.css   print stylesheet, used only by the PDF build
  build-pdf.py        Markdown -> one PDF per language
```

**The Markdown is the source. The PDFs are generated — never edit them.**
Rebuild after any change:

```bash
python3 docs/build-pdf.py        # both editions
python3 docs/build-pdf.py ja     # just one
```

It needs `markdown-it-py` and `playwright` with Chromium. Chromium does the
rendering because its print pipeline honours the `@page` and `break-inside`
rules the layout depends on. The Japanese edition needs a CJK font installed —
`fonts-noto-cjk` is what it was built with, and `IPAGothic` is the fallback in
the stylesheet.

## Keeping the two editions in step

The chapter files are numbered identically in both languages, so `en/07-blocks.md`
and `ja/07-blocks.md` are the same chapter. **Change one and change the other.**

## Terminology

Every interface label quoted in the manual is the exact string the interface
shows, and the Japanese edition uses the exact string from
`indico_blockschedule/translations/ja_JP/LC_MESSAGES/`. Chapter 15 is a full
English/Japanese glossary built from those catalogues, and it is the place to
check before inventing a word for anything.

Terms for parts of Indico outside this plugin (Features, Contributions,
Programme, Sessions, Tracks, Timetable) follow Indico's own `ja_JP` catalogue,
so a reader crossing between the manual and the site meets one word per thing.

## Screenshots

Taken from a real Indico instance with a purpose-built demonstration conference
— five rooms, four coloured tracks, two sessions, a lunch break spanning every
column, a session-block banner across two, and a handful of talks deliberately
left unscheduled so the side panel is not empty.

Re-shoot them after any interface change; a manual whose pictures predate the
interface is worse than one with no pictures. The phone-app shots were taken on
an HTTP-only host, where the app shows a notice saying it cannot be installed to
the home screen; that notice is a property of the server rather than of the app
and is suppressed in the shots.
