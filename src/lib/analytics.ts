import { addDays, dayMs, minutesSinceEpoch, weekdayOf } from "./parse";
import type {
  DayStat,
  DayStatDelta,
  HourlyDay,
  Message,
  Names,
  RangeKey,
  RangeOption,
  StreakSegment,
} from "./types";

export const RANGE_OPTIONS: RangeOption[] = [
  { key: "1W", label: "1週間", days: 7 },
  { key: "2W", label: "2週間", days: 14 },
  { key: "1M", label: "1ヶ月", days: 30 },
  { key: "ALL", label: "全期間", days: 9999 },
];

export const HOUR_SEGMENTS = [
  { key: "night", label: "深夜", range: "0–5時", hours: [0, 1, 2, 3, 4, 5], color: "#8B7CFF" },
  { key: "morning", label: "朝", range: "6–11時", hours: [6, 7, 8, 9, 10, 11], color: "#FFA63D" },
  { key: "afternoon", label: "昼", range: "12–17時", hours: [12, 13, 14, 15, 16, 17], color: "#30E07E" },
  { key: "evening", label: "夜", range: "18–23時", hours: [18, 19, 20, 21, 22, 23], color: "#5B9DFF" },
] as const;

export const LIFE_BANDS = [
  { key: "midnight", label: "深夜", range: "0–3時", hours: [0, 1, 2, 3], emoji: "🌙" },
  { key: "dawn", label: "明け方", range: "4–7時", hours: [4, 5, 6, 7], emoji: "🌅" },
  { key: "morning", label: "午前", range: "8–11時", hours: [8, 9, 10, 11], emoji: "☕" },
  { key: "noon", label: "お昼", range: "12–15時", hours: [12, 13, 14, 15], emoji: "🌞" },
  { key: "dusk", label: "夕方", range: "16–19時", hours: [16, 17, 18, 19], emoji: "🌇" },
  { key: "night", label: "夜", range: "20–23時", hours: [20, 21, 22, 23], emoji: "🌃" },
] as const;

export const TOPIC_DEFS = [
  {
    key: "food",
    label: "ご飯・食事",
    emoji: "🍚",
    keywords: ["ご飯", "ごはん", "ランチ", "ディナー", "食べ", "飲み", "カフェ", "ラーメン", "焼肉", "お腹", "お店"],
  },
  {
    key: "work",
    label: "仕事・学校",
    emoji: "💼",
    keywords: ["仕事", "会社", "学校", "授業", "会議", "バイト", "残業", "宿題", "テスト", "出勤"],
  },
  {
    key: "love",
    label: "気持ち・愛情",
    emoji: "💕",
    keywords: ["好き", "大好き", "愛", "会いたい", "寂しい", "かわいい", "ありがとう", "大切"],
  },
  {
    key: "plan",
    label: "予定・約束",
    emoji: "📅",
    keywords: ["明日", "今度", "予定", "約束", "行こう", "会おう", "週末", "来週"],
  },
  {
    key: "daily",
    label: "日常・雑談",
    emoji: "☀️",
    keywords: ["眠い", "疲れた", "天気", "暑い", "寒い", "雨", "帰り", "おはよう", "おやすみ"],
  },
] as const;

const TOPIC_RES = TOPIC_DEFS.map(
  (t) => new RegExp(t.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")),
);

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 絵文字1つ分（肌の色・異体字セレクタ・ZWJでつないだ合成絵文字もまとめて1つ）
const EMOJI_RE = /\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic}️?)*/gu;
const HYPE_RE = /笑|ｗ|w{1,}|草|!|！|\?|？|♡|❤|ー{2,}/g;

/** URL（言葉や絵文字の集計からは外す） */
export const URL_RE = /https?:\/\/[^\s<>"'）)」』】\]]+/g;
/** 通話の記録の行（☎ 通話時間 1:23 / ☎ 不在着信 など） */
export const CALL_LINE_RE = /^\s*☎/;

/** 集計用に、メッセージ本文からURLを除いたもの。通話の行は空にする */
export function textForCounting(content: string): string {
  if (CALL_LINE_RE.test(content)) return "";
  return content.indexOf("http") >= 0 ? content.replace(URL_RE, " ") : content;
}

// 文字の種類ごとのかたまり（カタカナ／英数字／漢字＋ひらがな）
const SCRIPT_RUN_RE = /[ァ-ヺー]+|[a-z0-9]+|[一-鿿々〆ヵヶぁ-ゖ]+/g;

// 数えない言葉（あいづち・助詞・助動詞など、意味の薄いもの）
const STOP_WORDS = new Set([
  "これ", "それ", "あれ", "どれ", "この", "その", "あの", "どの", "ここ", "そこ", "あそこ", "どこ",
  "こう", "そう", "どう", "こんな", "そんな", "あんな", "どんな",
  "はい", "うん", "ううん", "ええ", "いや", "いえ", "まあ", "えー", "あー", "おー", "へー", "ふーん",
  "です", "ます", "でし", "まし", "でした", "ました", "ません", "だっ", "だった", "でしょ", "でしょう", "だろ", "だろう",
  "した", "して", "しよ", "しよう", "する", "しな", "しない", "され", "させ", "できる", "でき",
  "いる", "いた", "いて", "ある", "あっ", "あった", "なる", "なっ", "なった", "なり", "いう", "いっ", "言う",
  "ない", "なく", "なかっ", "たい", "たく", "れる", "られる", "せる", "てる", "てた", "とく", "ちゃう", "ちゃっ",
  "から", "まで", "より", "ので", "のに", "けど", "けれど", "けども", "でも", "だから", "そして", "それで", "じゃあ",
  "って", "とか", "など", "だけ", "しか", "ばかり", "くらい", "ぐらい", "ほど", "なら", "たら", "だら",
  "また", "もう", "まだ", "ずっと", "ちょっと", "なんか", "なに", "なん", "あと", "ほんと", "ほんとに", "けっこう",
  "じゃ", "じゃん", "じゃない", "だね", "だよ", "だよね", "よね", "かな", "かも", "もの", "こと", "よう", "ため",
  "みたい", "っぽい", "だと", "とき", "ところ", "今日", "明日", "自分",
  "さま", "さん", "ちゃん", "くん", "しょ", "でしょ", "にし", "には", "とは", "では", "にも", "どうも", "おれ", "わたし", "あなた", "なんで", "なんだ", "あれば",
  "笑", "www", "ww",
]);

type WordSegmenter = { segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }> };
let segmenter: WordSegmenter | null | undefined;
function getSegmenter(): WordSegmenter | null {
  if (segmenter === undefined) {
    try {
      const I = Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => WordSegmenter };
      segmenter = I.Segmenter ? new I.Segmenter("ja", { granularity: "word" }) : null;
    } catch {
      segmenter = null;
    }
  }
  return segmenter;
}

/**
 * 1つのメッセージを言葉に分ける。
 * カタカナ・英数字はかたまりのまま1語（辞書にない「ロリ」なども正しく1語になる）、
 * 漢字とひらがなのかたまりは、ブラウザの日本語の単語分割でさらに分ける。
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const norm = text.normalize("NFKC").toLowerCase();
  const runs = norm.match(SCRIPT_RUN_RE);
  if (!runs) return out;
  const seg = getSegmenter();
  for (const run of runs) {
    const c = run.charCodeAt(0);
    const isKana = c >= 0x30a1 && c <= 0x30fc;
    const isLatin = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39);
    if (isKana || isLatin || !seg || run.length <= 2) {
      out.push(run);
    } else {
      // 漢字とひらがなのかたまりは、ブラウザの日本語の単語分割で分ける（「好き」「最高」など）。
      // 漢字のすぐ後ろで切れたひらがな（「会|いたい」の「いたい」など送りがな・活用の切れ端）は数えない
      let prevEndsKanji = false;
      for (const p of seg.segment(run)) {
        const w = p.segment;
        const last = w.charCodeAt(w.length - 1);
        const allHira = /^[ぁ-ゖー]+$/.test(w);
        if (p.isWordLike !== false && !(allHira && prevEndsKanji)) out.push(w);
        prevEndsKanji = (last >= 0x4e00 && last <= 0x9fff) || last === 0x3005;
      }
    }
  }
  // 「ロリロリ」のような繰り返しは1語（「ロリ」）として数える
  for (let i = 0; i < out.length; i++) {
    const m = /^(.{2,}?)\1+$/u.exec(out[i]);
    if (m) out[i] = m[1];
  }
  return out;
}

export function isCountableWord(w: string): boolean {
  if (Array.from(w).length < 2) return false;
  if (STOP_WORDS.has(w)) return false;
  if (/^[0-9]+$/.test(w)) return false;
  if (/^(.)\1+$/u.test(w)) return false; // 「ーー」「ww」など同じ文字の繰り返し
  if (/^ー/.test(w)) return false;
  return true;
}

export function rangeStartDate(RAW: DayStat[], key: RangeKey): string {
  const opt = RANGE_OPTIONS.find((r) => r.key === key) || RANGE_OPTIONS[0];
  const first = RAW[0].date;
  const last = RAW[RAW.length - 1].date;
  if (opt.days >= 9999) return first;
  const start = addDays(last, -(opt.days - 1));
  return start < first ? first : start;
}

export function sliceByRange<T extends DayStat>(RAW: T[], key: RangeKey): T[] {
  const start = rangeStartDate(RAW, key);
  let lo = 0;
  let hi = RAW.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (RAW[mid].date < start) lo = mid + 1;
    else hi = mid;
  }
  return RAW.slice(lo);
}

export function withDeltas(RAW: DayStat[]): DayStatDelta[] {
  return RAW.map((d, i) => {
    const prev = i === 0 ? d.total : RAW[i - 1].total;
    const delta = d.total - prev;
    return { ...d, dayDelta: delta, dayPct: prev === 0 ? 0 : (delta / prev) * 100 };
  });
}

export function streakSegments(RAW: DayStat[]): StreakSegment[] {
  if (RAW.length === 0) return [];
  const out: StreakSegment[] = [];
  let start = RAW[0].date;
  let len = 1;
  for (let i = 1; i < RAW.length; i++) {
    if (Math.round((dayMs(RAW[i].date) - dayMs(RAW[i - 1].date)) / 864e5) === 1) {
      len++;
    } else {
      out.push({ start, end: RAW[i - 1].date, length: len });
      start = RAW[i].date;
      len = 1;
    }
  }
  out.push({ start, end: RAW[RAW.length - 1].date, length: len });
  return out;
}

export function hourOf(m: Message): number {
  return (m.time.charCodeAt(0) - 48) * 10 + (m.time.charCodeAt(1) - 48);
}

export function hourlyTotals(sliced: DayStat[], hourly: HourlyDay[]): number[] {
  const map = new Map(hourly.map((h) => [h.date, h.hours]));
  const totals = new Array(24).fill(0);
  for (const d of sliced) {
    const hours = map.get(d.date);
    if (!hours) continue;
    for (let i = 0; i < 24; i++) totals[i] += hours[i];
  }
  return totals;
}

export function weekdayTotals(sliced: DayStat[]): number[] {
  const totals = new Array(7).fill(0);
  for (const d of sliced) totals[weekdayOf(d.date)] += d.total;
  return totals;
}

export function weekdayHourMatrix(messages: Message[]): number[][] {
  const m = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const msg of messages) {
    const h = hourOf(msg);
    if (h >= 0 && h < 24) m[weekdayOf(msg.date)][h]++;
  }
  return m;
}

export interface LifestyleResult {
  label: string;
  emoji: string;
  pct: number;
  concentration: string;
  weekdayLabel: string;
  detail: string;
}

export function lifestyle(messages: Message[], names: Names): { a: LifestyleResult; b: LifestyleResult } {
  const acc = {
    a: { hours: new Array(24).fill(0), weekday: new Array(7).fill(0) },
    b: { hours: new Array(24).fill(0), weekday: new Array(7).fill(0) },
  };
  for (const m of messages) {
    const who = m.sender === names.a ? "a" : m.sender === names.b ? "b" : null;
    if (!who) continue;
    const h = hourOf(m);
    if (h >= 0 && h < 24) acc[who].hours[h]++;
    acc[who].weekday[weekdayOf(m.date)]++;
  }
  const analyze = (x: { hours: number[]; weekday: number[] }): LifestyleResult => {
    const total = x.hours.reduce((s, v) => s + v, 0);
    if (total === 0) return { label: "データ不足", emoji: "🤔", pct: 0, concentration: "", weekdayLabel: "", detail: "" };
    const band = LIFE_BANDS.map((b) => ({
      band: b,
      share: b.hours.reduce<number>((s, h) => s + x.hours[h], 0) / total,
    })).reduce((best, cur) => (cur.share > best.share ? cur : best));
    const concentration =
      band.share >= 0.45 ? "一極集中型" : band.share >= 0.3 ? "やや集中型" : "まんべんなく型";
    const weekdaySum = [1, 2, 3, 4, 5].reduce((s, d) => s + x.weekday[d], 0);
    const weekendSum = x.weekday[0] + x.weekday[6];
    const weekdayAvg = weekdaySum / 5;
    const weekendAvg = weekendSum / 2;
    let weekdayLabel = "変わらず型";
    if (weekendAvg > weekdayAvg * 1.25) weekdayLabel = "休日おしゃべり型";
    else if (weekdayAvg > weekendAvg * 1.25) weekdayLabel = "平日おしゃべり型";
    return {
      emoji: band.band.emoji,
      label: `${band.band.label}型`,
      pct: Math.round(band.share * 100),
      concentration,
      weekdayLabel,
      detail: `${band.band.range}が中心・${concentration}・${weekdayLabel}`,
    };
  };
  return { a: analyze(acc.a), b: analyze(acc.b) };
}

export interface ReplyBucket {
  label: string;
  max: number;
  count: number;
}

export interface ReplyStats {
  buckets: ReplyBucket[];
  avgA: number | null;
  avgB: number | null;
  totalReplies: number;
}

export function replyStats(messages: Message[], names: Names): ReplyStats {
  const buckets: ReplyBucket[] = [
    { label: "1分未満", max: 1, count: 0 },
    { label: "1〜5分", max: 5, count: 0 },
    { label: "5〜30分", max: 30, count: 0 },
    { label: "30分〜3時間", max: 180, count: 0 },
    { label: "3〜24時間", max: 1440, count: 0 },
    { label: "24時間以上", max: Infinity, count: 0 },
  ];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const cur = messages[i];
    if (prev.sender === cur.sender) continue;
    const diff = minutesSinceEpoch(cur) - minutesSinceEpoch(prev);
    if (diff < 0) continue;
    const bucket = buckets.find((x) => diff < x.max);
    if (bucket) bucket.count++;
    if (cur.sender === names.a) a.push(diff);
    else if (cur.sender === names.b) b.push(diff);
  }
  const avg = (arr: number[]) => (arr.length === 0 ? null : arr.reduce((s, v) => s + v, 0) / arr.length);
  return { buckets, avgA: avg(a), avgB: avg(b), totalReplies: a.length + b.length };
}

export function wordRanking(messages: Message[], limit = 12): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.type !== "text") continue;
    for (const w of tokenize(textForCounting(m.content))) {
      if (!isCountableWord(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function emojiRanking(messages: Message[], limit = 12): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.type !== "text") continue;
    const found = textForCounting(m.content).match(EMOJI_RE);
    if (!found) continue;
    for (const e of found) counts.set(e, (counts.get(e) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([emoji, count]) => ({ emoji, count }));
}

export function topicCounts(messages: Message[]) {
  const counts: Record<string, number> = Object.fromEntries(TOPIC_DEFS.map((t) => [t.key, 0]));
  let total = 0;
  for (const m of messages) {
    if (m.type !== "text") continue;
    for (let i = 0; i < TOPIC_RES.length; i++) {
      if (TOPIC_RES[i].test(m.content)) {
        counts[TOPIC_DEFS[i].key]++;
        total++;
        break;
      }
    }
  }
  return TOPIC_DEFS.map((t) => ({
    ...t,
    count: counts[t.key],
    pct: total === 0 ? 0 : Math.round((counts[t.key] / total) * 100),
  })).sort((x, y) => y.count - x.count);
}

export type TypeKey = "text" | "stamp" | "photo" | "video" | "file" | "other";
export type TypeCounts = Record<"a" | "b", Record<TypeKey, number>>;

export function typeCounts(messages: Message[], names: Names): TypeCounts {
  const empty = (): Record<TypeKey, number> => ({ text: 0, stamp: 0, photo: 0, video: 0, file: 0, other: 0 });
  const out: TypeCounts = { a: empty(), b: empty() };
  for (const m of messages) {
    const who = m.sender === names.a ? "a" : m.sender === names.b ? "b" : null;
    if (who) out[who][m.type] = (out[who][m.type] || 0) + 1;
  }
  return out;
}

export function emojiTrend(messages: Message[]): { ym: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const m of messages) {
    if (m.type !== "text") continue;
    const found = textForCounting(m.content).match(EMOJI_RE);
    if (!found) continue;
    const ym = m.date.slice(0, 7);
    map.set(ym, (map.get(ym) || 0) + found.length);
  }
  return [...map.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([ym, count]) => ({ ym, label: `${parseInt(ym.split("-")[1])}月`, count }));
}

export interface MonthlyStat {
  ym: string;
  total: number;
  a: number;
  b: number;
  chars: number;
  days: number;
  topDay: DayStat;
}

export function monthlyStats(RAW: DayStat[]): MonthlyStat[] {
  const map = new Map<string, MonthlyStat>();
  for (const d of RAW) {
    const ym = d.date.slice(0, 7);
    let cur = map.get(ym);
    if (!cur) {
      cur = { ym, total: 0, a: 0, b: 0, chars: 0, days: 0, topDay: d };
      map.set(ym, cur);
    }
    cur.total += d.total;
    cur.a += d.a;
    cur.b += d.b;
    cur.chars += d.chars || 0;
    cur.days += 1;
    if (d.total > cur.topDay.total) cur.topDay = d;
  }
  return [...map.values()].sort((x, y) => (x.ym < y.ym ? 1 : -1));
}

export interface CalendarDay {
  date: string;
  total: number;
  weekday: number;
}

export function calendarDays(RAW: DayStat[]): CalendarDay[] {
  const map = Object.fromEntries(RAW.map((d) => [d.date, d.total]));
  const start = new Date(`${RAW[0].date}T00:00:00`);
  const end = new Date(`${RAW[RAW.length - 1].date}T00:00:00`);
  const out: CalendarDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const date = `${y}-${m}-${d}`;
    out.push({ date, total: map[date] || 0, weekday: cursor.getDay() });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface Milestone {
  type: "day" | "anniv";
  label: string;
  date?: string;
  dateObj?: Date;
}

export interface MilestoneInfo {
  distinctDays: number;
  nextTarget: number;
  isExact: boolean;
  anniversaryYears: number | null;
  achieved: Milestone[];
}

export function milestones(RAW: DayStat[]): MilestoneInfo {
  const days = RAW.length;
  const nextTarget = days % 50 === 0 && days > 0 ? days : Math.ceil((days + 1) / 50) * 50;
  const isExact = days > 0 && days % 50 === 0;
  const first = new Date(`${RAW[0].date}T00:00:00`);
  const last = new Date(`${RAW[RAW.length - 1].date}T00:00:00`);
  let anniversaryYears: number | null = null;
  const achieved: Milestone[] = [];
  for (let y = 1; y <= 20; y++) {
    const d = new Date(first);
    d.setFullYear(first.getFullYear() + y);
    if (d > last) break;
    achieved.push({ type: "anniv", label: `${y}周年`, dateObj: d });
    if (Math.abs(d.getTime() - last.getTime()) <= 3 * 864e5) anniversaryYears = y;
  }
  for (let n = 50; n <= days; n += 50) {
    achieved.push({ type: "day", label: `累計${n}日目`, date: RAW[n - 1].date });
  }
  achieved.sort((x, y) => {
    const tx = x.dateObj ? x.dateObj.getTime() : new Date(`${x.date}T00:00:00`).getTime();
    const ty = y.dateObj ? y.dateObj.getTime() : new Date(`${y.date}T00:00:00`).getTime();
    return tx - ty;
  });
  return { distinctDays: days, nextTarget, isExact, anniversaryYears, achieved };
}

export interface HotConversation {
  date: string;
  start: string;
  end: string;
  endDate: string;
  count: number;
  durMin: number;
  highlights: Message[];
}

function hypeScore(m: Message): number {
  const c = m.content;
  const marks = (c.match(HYPE_RE) || []).length + (c.match(EMOJI_RE) || []).length;
  return Math.min(4, marks) * 2 + Math.min(c.length, 40) / 10;
}

/** Finds the liveliest back-and-forth burst on or after `fromDate`. */
export function hotConversation(messages: Message[], fromDate: string): HotConversation | null {
  let lo = 0;
  let hi = messages.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (messages[mid].date < fromDate) lo = mid + 1;
    else hi = mid;
  }
  const bursts: { i0: number; i1: number; startT: number; lastT: number }[] = [];
  let cur: { i0: number; i1: number; startT: number; lastT: number } | null = null;
  for (let i = lo; i < messages.length; i++) {
    const t = minutesSinceEpoch(messages[i]);
    if (cur && t - cur.lastT <= 30) {
      cur.i1 = i;
      cur.lastT = t;
    } else {
      cur = { i0: i, i1: i, startT: t, lastT: t };
      bursts.push(cur);
    }
  }
  const candidates: { burst: typeof bursts[number]; n: number; base: number; ub: number }[] = [];
  for (const b of bursts) {
    const n = b.i1 - b.i0 + 1;
    if (n < 6) continue;
    const bySender: Record<string, number> = {};
    for (let i = b.i0; i <= b.i1; i++) bySender[messages[i].sender] = (bySender[messages[i].sender] || 0) + 1;
    const sorted = Object.values(bySender).sort((x, y) => y - x);
    if (sorted.length < 2) continue;
    const ratio = sorted[1] / sorted[0];
    const dur = Math.max(1, b.lastT - b.startT);
    const base = n * (0.5 + ratio) + Math.min(dur, 120) * 0.05;
    candidates.push({ burst: b, n, base, ub: base + 6 * n });
  }
  candidates.sort((x, y) => y.ub - x.ub);
  let best: { score: number; burst: typeof bursts[number]; texts: Message[] } | null = null;
  for (const c of candidates) {
    if (best && c.ub < best.score) break;
    const b = c.burst;
    const texts: Message[] = [];
    let bonus = 0;
    for (let i = b.i0; i <= b.i1; i++) {
      const m = messages[i];
      if (m.type === "text") {
        texts.push(m);
        bonus += Math.min(4, (m.content.match(HYPE_RE) || []).length + (m.content.match(EMOJI_RE) || []).length);
      }
    }
    const score = c.base + bonus * 1.5;
    if (!best || score > best.score || (score === best.score && b.i0 < best.burst.i0)) {
      best = { score, burst: b, texts };
    }
  }
  if (!best) return null;
  const b = best.burst;
  const highlights = best.texts
    .filter((m) => m.content.trim().length >= 3 && !/https?:\/\//.test(m.content))
    .map((m, i) => ({ m, i, sc: hypeScore(m) }))
    .sort((x, y) => y.sc - x.sc)
    .slice(0, 4)
    .sort((x, y) => x.i - y.i)
    .map((x) => x.m);
  const first = messages[b.i0];
  const last = messages[b.i1];
  return {
    date: first.date,
    start: first.time,
    end: last.time,
    endDate: last.date,
    count: b.i1 - b.i0 + 1,
    durMin: Math.round(b.lastT - b.startT),
    highlights,
  };
}

export function weeklyReport(RAW_D: DayStat[]) {
  const n = RAW_D.length;
  const last7 = RAW_D.slice(Math.max(0, n - 7));
  const prev7 = RAW_D.slice(Math.max(0, n - 14), Math.max(0, n - 7));
  const sum = (arr: DayStat[]) => arr.reduce((s, d) => s + d.total, 0);
  const last7Total = sum(last7);
  const prev7Total = sum(prev7);
  return {
    last7Total,
    prev7Total,
    diff: last7Total - prev7Total,
    busiest: last7.reduce((best, d) => (d.total > best.total ? d : best), last7[0]),
    days: last7.length,
  };
}

export function rangeSummary(sliced: DayStat[]) {
  const total = sliced.reduce((s, d) => s + d.total, 0);
  const chars = sliced.reduce((s, d) => s + (d.chars || 0), 0);
  const a = sliced.reduce((s, d) => s + d.a, 0);
  const b = sliced.reduce((s, d) => s + d.b, 0);
  const peak = sliced.reduce((best, d) => (d.total > best.total ? d : best), sliced[0]);
  const low = sliced.reduce((worst, d) => (d.total < worst.total ? d : worst), sliced[0]);
  const days = Math.max(1, sliced.length);
  return {
    total,
    chars,
    a,
    b,
    avg: total / days,
    avgChars: chars / days,
    peak,
    low,
    aShare: total === 0 ? 50 : Math.round((a / total) * 100),
    days,
  };
}

export function bestWeekday(weekday: number[]): { index: number; total: number } {
  let index = 0;
  for (let i = 1; i < 7; i++) if (weekday[i] > weekday[index]) index = i;
  return { index, total: weekday[index] };
}

export function busiestHour(hours: number[]): { hour: number; total: number } {
  let hour = 0;
  for (let i = 1; i < 24; i++) if (hours[i] > hours[hour]) hour = i;
  return { hour, total: hours[hour] };
}

export function hourSegmentTotals(hours: number[]) {
  const total = hours.reduce((s, v) => s + v, 0);
  return HOUR_SEGMENTS.map((seg) => {
    const count = seg.hours.reduce<number>((s, h) => s + hours[h], 0);
    return { ...seg, count, pct: total === 0 ? 0 : Math.round((count / total) * 100) };
  });
}
