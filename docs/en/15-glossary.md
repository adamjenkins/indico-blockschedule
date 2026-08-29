# 15. Glossary

Every term below is what the interface actually says, character for character,
including the `{placeholders}` — so a row here can be looked up directly in the
plugin's translation catalogue. The Japanese column is the word the same control
shows when Indico is set to Japanese, which makes this table the bridge between
this manual and its Japanese edition.

The English is Indico's **British English** (`en_GB`), which is what the
screenshots show: *Customisation*, *Organisation*, *colour*. A site set to
American English says *Customization*, *Organization*, *color* for the same
things.

## Concepts

| English | 日本語 | Meaning |
|---|---|---|
| Contribution | 投稿 | One talk, poster or presentation. Indico's own word |
| Track | トラック | A thematic strand of the programme |
| Session | セッション | An Indico session a contribution belongs to |
| Speaker | 発表者 | Who is giving the talk |
| Room | 部屋 | Indico reserves 会場 for a *venue* |
| Column | 列 | One vertical division of the grid — in practice, a room |
| Spanning block | 全体ブロック | A bar across **every** column |
| Session block | セッションブロック | A banner across **some** columns |
| Room groups | 部屋グループ | Named sets of rooms, for filtering and printing |
| Working hours | 表示時間帯 | The **Day starts**–**Day ends** window |
| Unscheduled contributions | 未配置の投稿 | Talks with no time yet |
| Autoschedule | 自動配置 | Fill a timespan automatically |
| Track colours | トラックの色 | The per-track badge colour |

> Three of these are not standalone entries in a catalogue and are derived from
> longer ones, so here is where each came from: **Speaker** from Indico's
> *Speakers* → 発表者 (and the plugin's *Filter by title or speaker…* →
> タイトルまたは発表者で絞り込み…), **Working hours** from *Outside working hours
> ({start}–{end})* → 表示時間帯（{start}–{end}）の外です, and **Autoschedule**
> from *Autoschedule…* → 自動配置…. Nothing in this table was invented.

## The management toolbar

| English | 日本語 |
|---|---|
| Day starts | 開始時刻 |
| Day ends | 終了時刻 |
| Slot (min) | スロット（分） |
| Gap after contributions (min) | 投稿後の間隔（分） |
| Snap to (min, 0 = off) | スナップ幅（分、0で無効） |
| Row height (px) | 行の高さ（px） |
| Title lines (0 = no limit) | タイトルの行数（0で無制限） |
| Full day | 終日 |
| Show session/track | セッション・トラックを表示 |
| Description | 説明 |
| Hidden / Truncated / Full | 非表示 / 省略 / 全文 |
| Room groups | 部屋グループ |
| All rooms | すべての部屋 |
| All tracks | すべてのトラック |
| Showing {visible} of {total} rooms | {total}部屋中{visible}部屋を表示 |
| Clear | クリア |
| Autoschedule… | 自動配置… |
| Track colours | トラックの色 |
| Export… | エクスポート… |
| View fullscreen / Exit fullscreen | 全画面表示 / 全画面表示を終了 |

## Building the grid

| English | 日本語 |
|---|---|
| Column | 列 |
| Pick a room (optional)… | 部屋を選択（任意）… |
| Column name | 列名 |
| Add column | 列を追加 |
| Minimum column width (px), 0 for no minimum | 列の最小幅（px、0で指定なし） |
| Spanning block | 全体ブロック |
| Spanning block title (e.g. Lunch break) | 全体ブロックのタイトル（例：昼休み） |
| Add spanning block | 全体ブロックを追加 |
| Session block | セッションブロック |
| Pick a session (optional)… | セッションを選択（任意）… |
| Session block title | セッションブロックのタイトル |
| Add session block | セッションブロックを追加 |
| min | 分 |

## Messages while scheduling

| English | 日本語 |
|---|---|
| Outside working hours ({start}–{end}) | 表示時間帯（{start}–{end}）の外です |
| Overlaps another contribution | ほかの投稿と重複しています |

## The unscheduled panel

| English | 日本語 |
|---|---|
| Unscheduled contributions | 未配置の投稿 |
| Filter by title or speaker… | タイトルまたは発表者で絞り込み… |
| All contributions are scheduled. | すべての投稿が配置されています。 |
| No unscheduled contributions match the current filters. | 現在の絞り込み条件に一致する未配置の投稿はありません。 |

## Room groups

| English | 日本語 |
|---|---|
| Room groups | 部屋グループ |
| No groups yet. | グループはまだありません。 |
| No rooms | 部屋なし |
| New group name | 新しいグループ名 |
| Add group | グループを追加 |
| Delete this group | このグループを削除 |
| Cancel / Delete | キャンセル / 削除 |

## Autoschedule

| English | 日本語 |
|---|---|
| From / To | 開始 / 終了 |
| Exclude | 除外 |
| Sessions… / Tracks… | セッション… / トラック… |
| Clear schedule (does not reschedule) | 配置を解除する（再配置は行いません） |
| Clear schedule | 配置を解除 |
| Run autoschedule | 自動配置を実行 |
| Schedule cleared for the given timespan. | 指定した時間帯の配置を解除しました。 |
| Everything was scheduled. | すべて配置しました。 |
| Could not fit {count} contribution(s) in the given timespan: {titles} | 指定した時間帯に収まらなかった投稿が{count}件あります：{titles} |

## Track colours

| English | 日本語 |
|---|---|
| Track colours | トラックの色 |
| Colour for {track} | {track}の色 |
| Default | デフォルト |
| Save colours | 色を保存 |
| Saved. | 保存しました。 |
| Back to the schedule | スケジュールに戻る |
| WCAG contrast ratio of the badge text against its background | バッジの文字と背景の WCAG コントラスト比 |

## The display page

| English | 日本語 |
|---|---|
| Highlight my timetable | お気に入りを強調表示 |
| Black and white | 白黒 |
| Add to my timetable | お気に入りに追加 |
| Remove from my timetable | お気に入りから外す |
| Print… | 印刷… |
| Paper size | 用紙サイズ |
| Orientation | 用紙の向き |
| Portrait / Landscape | 縦向き / 横向き |
| Print | 印刷 |

## Two places where the two languages do not line up word for word

Both are deliberate, and both are worth knowing if you work with a bilingual
committee.

**"my timetable" vs お気に入り.** The English favourite controls say *Add to my
timetable* and *Highlight my timetable*, following Indico's own English wording.
The Japanese says お気に入り ("favourites"), following Indico's own Japanese. They
are the same feature.

**投稿 vs 講演.** The plugin says 投稿 for a contribution, which is Indico's word.
The phone app (chapter 13) says 講演 for a talk on its schedule screen, because
it is showing them to attendees rather than to organisers. Again, the same
objects.
