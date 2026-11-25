import type { IconName } from "./components/Icon";

export type ViewKey =
  | "overview"
  | "detail"
  | "history"
  | "streak"
  | "hourly"
  | "breakdown"
  | "calendarmap"
  | "search"
  | "monthly"
  | "compare"
  | "share"
  | "replay"
  | "memories"
  | "words"
  | "calls";

export interface ViewMeta {
  key: ViewKey;
  label: string;
  icon: IconName;
  title: string;
  description: string;
  group: "分析" | "ふり返り" | "ツール";
}

export const VIEWS: ViewMeta[] = [
  {
    key: "overview",
    label: "概要",
    icon: "overview",
    title: "概要",
    description: "ふたりの会話の全体像。まずはここから。",
    group: "分析",
  },
  {
    key: "detail",
    label: "詳細",
    icon: "detail",
    title: "詳細統計",
    description: "文字数・返信速度・盛り上がった話など、深掘りした数字。",
    group: "分析",
  },
  {
    key: "hourly",
    label: "時間帯",
    icon: "clock",
    title: "時間帯分析",
    description: "何時ごろ、何曜日に話すことが多いのか。",
    group: "分析",
  },
  {
    key: "breakdown",
    label: "内訳",
    icon: "pie",
    title: "内訳・ランキング",
    description: "メッセージの種類、よく使う言葉・絵文字、話題の傾向。",
    group: "分析",
  },
  {
    key: "words",
    label: "ことば",
    icon: "quote",
    title: "ことば",
    description: "言葉の推移、ふたりの口ぐせ、共有したリンク。",
    group: "分析",
  },
  {
    key: "calls",
    label: "通話",
    icon: "phone",
    title: "通話の記録",
    description: "通話した回数と時間、長電話ランキング。",
    group: "分析",
  },
  {
    key: "memories",
    label: "思い出",
    icon: "gift",
    title: "思い出",
    description: "○年前の今日、はじめての記録、記念日、年ごとのまとめ。",
    group: "ふり返り",
  },
  {
    key: "history",
    label: "履歴",
    icon: "history",
    title: "日別履歴",
    description: "日ごとのやりとりを一覧で。気になる日をクリック。",
    group: "ふり返り",
  },
  {
    key: "streak",
    label: "記録",
    icon: "flame",
    title: "連続記録",
    description: "毎日話せた日数と、これまでの記録。",
    group: "ふり返り",
  },
  {
    key: "calendarmap",
    label: "カレンダー",
    icon: "calendar",
    title: "カレンダー",
    description: "月ごとのにぎわいをカレンダーで眺める。",
    group: "ふり返り",
  },
  {
    key: "monthly",
    label: "月次",
    icon: "monthly",
    title: "月次トレンド",
    description: "月ごとの増減と、いちばん話した月。",
    group: "ふり返り",
  },
  {
    key: "search",
    label: "検索",
    icon: "search",
    title: "キーワード検索",
    description: "トークの中から言葉を探す。",
    group: "ツール",
  },
  {
    key: "compare",
    label: "比較",
    icon: "compare",
    title: "比較",
    description: "期間どうし、または別のトークファイルと比べる。",
    group: "ツール",
  },
  {
    key: "replay",
    label: "再生",
    icon: "play",
    title: "トーク再生",
    description: "会話の流れをそのまま再生。",
    group: "ツール",
  },
  {
    key: "share",
    label: "シェア",
    icon: "share",
    title: "シェアカード",
    description: "ふたりの記録を画像にして保存・共有。",
    group: "ツール",
  },
];

export const VIEW_MAP: Record<ViewKey, ViewMeta> = Object.fromEntries(
  VIEWS.map((v) => [v.key, v]),
) as Record<ViewKey, ViewMeta>;

export const PRIMARY_VIEWS: ViewKey[] = ["overview", "detail", "hourly", "breakdown"];
export const MOBILE_VIEWS: ViewKey[] = ["overview", "history", "hourly", "breakdown", "share"];
