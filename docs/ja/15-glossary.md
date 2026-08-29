# 15. 用語集

以下はすべて、画面に実際に表示される語を、`{プレースホルダー}` も含めて一字一句そのまま載せたものです。そのため、この表の行はプラグインの翻訳カタログでそのまま検索できます。日本語の欄は、Indico を日本語表示にしたときに同じコントロールに表示される語で、この表が英語版マニュアルとの橋渡しになります。

英語は Indico の**イギリス英語**（`en_GB`）で、スクリーンショットもこの表示です。*Customisation*、*Organisation*、*colour* のようになります。アメリカ英語に設定されたサイトでは、同じものが *Customization*、*Organization*、*color* と表示されます。

## 用語


| English | 日本語 | 意味 |
|---|---|---|
| Contribution | 投稿 | 1件の講演・ポスター・発表。Indico の用語です |
| Track | トラック | プログラムのテーマ別の区分 |
| Session | セッション | 投稿が属する Indico のセッション |
| Speaker | 発表者 | 発表を行う人 |
| Room | 部屋 | Indico は 会場 を *venue* の訳に使っています |
| Column | 列 | グリッドの縦方向の区切り。実際には部屋 |
| Spanning block | 全体ブロック | **すべての**列にまたがる帯 |
| Session block | セッションブロック | **一部の**列にまたがる見出し |
| Room groups | 部屋グループ | 絞り込みと印刷のための、名前を付けた部屋の集合 |
| Working hours | 表示時間帯 | **開始時刻**〜**終了時刻**の範囲 |
| Unscheduled contributions | 未配置の投稿 | まだ時刻が決まっていない投稿 |
| Autoschedule | 自動配置 | 時間帯を自動的に埋める |
| Track colours | トラックの色 | トラックごとのバッジの色 |

> このうち3語はカタログに単独の項目としては存在せず、より長い文から取り出したものです。出典を挙げておきます。**Speaker** は Indico の *Speakers* → 発表者（およびプラグインの *Filter by title or speaker…* → タイトルまたは発表者で絞り込み…）、**Working hours** は *Outside working hours ({start}–{end})* → 表示時間帯（{start}–{end}）の外です、**Autoschedule** は *Autoschedule…* → 自動配置… です。この表に独自に作った訳語はありません。

## 管理画面のツールバー

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

## グリッドを組み立てる

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

## 配置中に表示されるメッセージ

| English | 日本語 |
|---|---|
| Outside working hours ({start}–{end}) | 表示時間帯（{start}–{end}）の外です |
| Overlaps another contribution | ほかの投稿と重複しています |

## 未配置の投稿パネル

| English | 日本語 |
|---|---|
| Unscheduled contributions | 未配置の投稿 |
| Filter by title or speaker… | タイトルまたは発表者で絞り込み… |
| All contributions are scheduled. | すべての投稿が配置されています。 |
| No unscheduled contributions match the current filters. | 現在の絞り込み条件に一致する未配置の投稿はありません。 |

## 部屋グループ

| English | 日本語 |
|---|---|
| Room groups | 部屋グループ |
| No groups yet. | グループはまだありません。 |
| No rooms | 部屋なし |
| New group name | 新しいグループ名 |
| Add group | グループを追加 |
| Delete this group | このグループを削除 |
| Cancel / Delete | キャンセル / 削除 |

## 自動配置

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

## トラックの色

| English | 日本語 |
|---|---|
| Track colours | トラックの色 |
| Colour for {track} | {track}の色 |
| Default | デフォルト |
| Save colours | 色を保存 |
| Saved. | 保存しました。 |
| Back to the schedule | スケジュールに戻る |
| WCAG contrast ratio of the badge text against its background | バッジの文字と背景の WCAG コントラスト比 |

## 表示ページ

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

## 英語と日本語が一語一語では対応しない2か所

どちらも意図的なものです。二言語で作業する委員会では知っておくと役に立ちます。

**"my timetable" と お気に入り。** 英語のお気に入り操作は Indico 自身の英語表記に従って *Add to my timetable*、*Highlight my timetable* となっています。日本語は Indico 自身の日本語に従って お気に入り です。同じ機能を指しています。

**投稿 と 講演。** このプラグインは Indico の用語に従って、contribution を 投稿 と表記します。スマートフォンアプリ（第13章）はプログラム画面で talk を 講演 と表記します。運営者ではなく参加者に見せる画面だからです。こちらも同じものを指しています。
