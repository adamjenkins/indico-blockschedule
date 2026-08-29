#!/usr/bin/env python3
# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.
"""Compile a language's Markdown chapters into one offline PDF.

    python3 docs/build-pdf.py            # both languages
    python3 docs/build-pdf.py ja         # just one

The Markdown files are the source; the PDF is generated and should never be
edited. Chromium does the rendering, because its print pipeline honours the
@page and break-inside rules in `assets/manual.css` that make a manual read like
a manual rather than a long web page.

Needs `markdown-it-py` and `playwright` (with Chromium installed).
"""
import pathlib
import re
import sys

from markdown_it import MarkdownIt
from playwright.sync_api import sync_playwright


HERE = pathlib.Path(__file__).parent.resolve()

EDITIONS = {
    'en': {
        'title': 'Block Schedule',
        'subtitle': "Conference Manager's Manual",
        'output': 'BlockSchedule-Manager-Manual-en.pdf',
        'footer': "Block Schedule — Conference Manager's Manual",
        'html_lang': 'en',
        'meta': ['For Indico event managers',
                 'Block Schedule plugin for Indico',
                 'Screenshots taken from a live Indico site'],
    },
    'ja': {
        'title': 'Block Schedule',
        'subtitle': '大会運営者向けマニュアル',
        'output': 'BlockSchedule-Manager-Manual-ja.pdf',
        'footer': 'Block Schedule — 大会運営者向けマニュアル',
        'html_lang': 'ja',
        'meta': ['Indico のイベント管理者向け',
                 'Indico 用 Block Schedule プラグイン',
                 'スクリーンショットは実際の Indico サイトのものです'],
    },
}

FOOTER = ('<div style="width:100%;font-size:7.5pt;color:#5b6470;'
          'font-family:\'Noto Sans CJK JP\',Helvetica,Arial,sans-serif;padding:0 18mm;">'
          '<span style="float:left;">{label}</span>'
          '<span style="float:right;">'
          '<span class="pageNumber"></span> / <span class="totalPages"></span>'
          '</span></div>')

md = MarkdownIt('gfm-like')


def render_chapter(path, lang):
    """One chapter's Markdown as an HTML <section>."""
    text = path.read_text(encoding='utf-8')

    # Cross-chapter links become in-document anchors -- there are no separate
    # pages in a PDF, and a link to `04-columns.md` would simply be dead.
    text = re.sub(r'\]\((\d\d-[a-z-]+)\.md\)', r'](#\1)', text)

    html = md.render(text)

    # Images: resolve `../images/<lang>/x.png` against this directory, and wrap
    # each in a <figure> so the stylesheet can keep it whole across a page break.
    def as_figure(match):
        src, alt = match.group(1), match.group(2)
        resolved = (path.parent / src).resolve()
        phone = ' class="phone"' if '/app-' in src else ''
        return (f'<figure{phone}><img src="file://{resolved}" alt="{alt}">'
                f'<figcaption>{alt}</figcaption></figure>')

    html = re.sub(r'<p><img src="([^"]*)" alt="([^"]*)"[^>]*></p>', as_figure, html)

    # A long table (the glossary) may break across pages, with its header
    # repeating; a short one is kept whole.
    parts = html.split('<table>')
    rebuilt = parts[0]
    for part in parts[1:]:
        body, _sep, rest = part.partition('</table>')
        tag = '<table class="long">' if body.count('<tr>') > 12 else '<table>'
        rebuilt += tag + body + '</table>' + rest
    html = rebuilt

    anchor = path.stem
    return f'<section class="chapter" id="{anchor}">\n{html}\n</section>'


def build(lang):
    edition = EDITIONS[lang]
    src_dir = HERE / lang
    chapters = sorted(src_dir.glob('*.md'))
    if not chapters:
        sys.exit(f'no Markdown chapters in {src_dir}')

    cover = (
        '<div class="cover">'
        '<div class="rule"></div>'
        f'<h1>{edition["title"]}</h1>'
        f'<p class="subtitle">{edition["subtitle"]}</p>'
        '<div class="meta">'
        + ''.join(f'<div>{line}</div>' for line in edition['meta'])
        + '</div></div>'
    )

    body = cover + '\n'.join(render_chapter(c, lang) for c in chapters)
    css = (HERE / 'assets' / 'manual.css').read_text(encoding='utf-8')
    page = (f'<!doctype html><html lang="{edition["html_lang"]}"><head>'
            f'<meta charset="utf-8"><title>{edition["title"]} — {edition["subtitle"]}</title>'
            f'<style>{css}</style></head><body>{body}</body></html>')

    scratch = HERE / f'.build-{lang}.html'
    scratch.write_text(page, encoding='utf-8')
    out = HERE / edition['output']

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        tab = browser.new_page()
        tab.goto(f'file://{scratch}', wait_until='networkidle')
        tab.pdf(path=str(out), format='A4', print_background=True,
                margin={'top': '20mm', 'bottom': '16mm', 'left': '18mm', 'right': '18mm'},
                display_header_footer=True, header_template='<div></div>',
                footer_template=FOOTER.format(label=edition['footer']))
        browser.close()

    scratch.unlink()
    print(f'wrote {out.name}  ({len(chapters)} chapters, {out.stat().st_size // 1024} KB)')


wanted = sys.argv[1:] or list(EDITIONS)
for lang in wanted:
    if lang not in EDITIONS:
        sys.exit(f'unknown edition {lang!r}; known: {list(EDITIONS)}')
    build(lang)
