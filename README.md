# トーク分析 — Talk Log Analyzer

[![CI](https://github.com/yutopias09/talk-log/actions/workflows/ci.yml/badge.svg)](https://github.com/yutopias09/talk-log/actions/workflows/ci.yml)

LINEのトーク履歴（テキスト書き出し）を読み込んで、ふたりの会話を可視化するローカル分析ツールです。
データはブラウザの中だけで処理され、サーバーへの送信は一切ありません。

公開版: <https://yutopias09.github.io/talk-log/>

## すぐに使う

`index.html` または `line_chat_analyzer_web.html` をブラウザで開くだけです。
どちらもビルド済みの単一HTMLなので、ローカルサーバーやインストールは不要です。
ファイルを開いたら「サンプルで試す」で動作を確認できます。

1. LINEのトーク画面右上の設定を開く
2. 「トーク履歴を送信」→「テキストファイル」を選ぶ
3. 保存した `.txt` ファイルを画面にドロップ（または「ファイルを選ぶ」）

対応している書き出し形式:

- 標準形式: `2025/12/06(土)` の日付行 + `21:09\t名前\t本文`
- スペース区切り形式: `2025.12.06 土曜日` の日付行 + `21:09 名前 本文`
- 12時間表記: `2023/07/31(月)` の日付行 + `午後05:40	名前	本文`（午前／午後）
- 文字コード: UTF-8 / Shift-JIS / UTF-16 を自動判定

## 主な機能

| 画面 | 内容 |
| --- | --- |
| 概要 | 期間のメッセージ数・文字数・ピーク時間、推移チャート、ふたりの割合、盛り上がった話、直近7日間 |
| 詳細統計 | 返信スピード、生活タイプ診断、文字数の推移、メッセージ種類、最多・最少日 |
| 時間帯分析 | 24時間の分布、時間帯の内訳、曜日×時間帯ヒートマップ |
| 内訳・ランキング | メッセージ種別、よく使う言葉（日本語の形態素分割）、絵文字、話題分類、絵文字の推移 |
| 日別履歴 | 日ごとの一覧、絞り込み、並び替え、その日のメッセージ表示 |
| 連続記録 | いまの記録・最長記録・次の目標、直近60日、マイルストーン |
| カレンダー | 月ごとのヒートマップ、日付ごとのメッセージ |
| 月次トレンド | 月ごとの増減、月別内訳、累計 |
| キーワード検索 | 送信者・種類で絞り込める全文検索、ハイライト |
| 比較 | 前期間との比較、または別のトークファイルとの比較 |
| シェアカード | 4:5 / 1:1 / 9:16 の画像を生成。3テーマ、PNG保存・共有 |
| トーク再生 | 一日の会話を再生（1x / 2x / 4x） |

デスクトップでは左サイドバー＋マルチカラム、スマートフォンでは下部タブ＋メニューシートに切り替わります。
ライト／ダークテーマに対応し、配色は WCAG AA のコントラストを満たすよう調整しています。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173 （/ は app.html へ内部リダイレクト）
npm run build    # 型チェック → 単一HTMLを index.html / line_chat_analyzer_web.html / dist/index.html に生成
```

### 構成

```
app.html               Vite の開発エントリ（ソース）
index.html             ビルド済みアプリ（GitHub Pages が配信するルート）
line_chat_analyzer_web.html  同じビルドの単一HTML（従来のファイル名）
src/
  App.tsx              アプリシェル、ファイル読み込み、画面切り替え
  nav.ts               画面定義とナビゲーション
  styles.css           デザイントークンと全スタイル
  lib/
    parse.ts           LINEトーク履歴パーサー（タブ区切り／CRLF／Shift-JISフォールバック）
    analytics.ts       集計ロジック（連続記録、時間帯、返信速度、ランキング、話題、盛り上がり検出など）
    share.ts           シェアカードのCanvas描画
    useStats.ts        期間スライスとテーマ／保存状態のフック
    sample.ts          サンプルデータ生成
  components/          アイコン、汎用UI、SVGチャート
  views/               12画面
scripts/
  copy-single.mjs      ビルド結果を単一HTMLとして配置・検証
legacy/
  line_chat_analyzer_web.html   旧・単一HTML版（参考用）
```

- React 18 + TypeScript + Vite
- チャートは外部ライブラリを使わない手書きSVG（軽量・テーマ追従・スクリーンリーダー向けの説明付き）
- シェアカードは Canvas 2D で描画し、端末内でPNG化
- 単一HTML出力は `vite-plugin-singlefile`

## 公開（GitHub Pages）

GitHub Pages は **main ブランチのルート** を配信する設定です。ルートの `index.html` が
そのままアプリになるため、追加のデプロイ設定なしで公開されます。

```bash
npm run build
git add index.html line_chat_analyzer_web.html
git commit -m "Rebuild standalone HTML"
git push
```

push すると GitHub の Pages ビルドが走り、数十秒で反映されます。

## CI

`.github/workflows/ci.yml` が push / pull request 時に次を実行します。

- `npm ci` → 型チェック → 単一HTMLビルド
- 生成物が自己完結していること（外部アセット参照がないこと）を検証
- コミット済みの `index.html` / `line_chat_analyzer_web.html` がビルド結果と一致するか検証
  （古い場合は失敗するので、`npm run build` してコミットしてください）
- ビルド済みHTMLを Actions の Artifacts にアップロード

## プライバシー

- 読み込んだファイルは `FileReader` でブラウザ内だけに読み込まれます
- 解析結果・カード画像はどこにもアップロードされません
- Webフォント（Google Fonts）だけは読み込み時に通信します。オフラインでもシステムフォントで動作します

## 旧版

`legacy/line_chat_analyzer_web.html` に、リニューアル前の単一HTML版を残しています。
