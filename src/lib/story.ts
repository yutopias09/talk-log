import { emojiRanking, hotConversation, milestones, wordRanking, WEEKDAY_LABELS, type HotConversation } from "./analytics";
import { fmtDateJP, fmtDateShort, fmtInt } from "./format";
import { dayMs, weekdayOf } from "./parse";
import type { Names, ParsedChat, StreakSegment } from "./types";

/** ストーリー（インスタのストーリーズ風のふり返り）の1枚 */
export interface StorySlide {
  kind: "text" | "bar" | "rank" | "bubbles" | "finale";
  emoji: string;
  caption: string;
  title?: string;
  /** 数字を大きく見せるとき（カウントアップする） */
  count?: number;
  suffix?: string;
  sub?: string;
  hint?: string;
  rows?: { label: string; pct: number; count: number }[];
  items?: { label: string; value: number }[];
  topic?: HotConversation;
  names?: Names;
  bg: [string, string];
}

const STORY_BGS: [string, string][] = [
  ["#4F8CFF", "#8B5CF6"],
  ["#FF7CC8", "#FFA63D"],
  ["#2FCBA3", "#3DB1FF"],
  ["#FF6F6F", "#FFC24B"],
  ["#6366F1", "#EC4899"],
  ["#0EA5E9", "#22C55E"],
  ["#F97316", "#DB2777"],
  ["#7C3AED", "#2563EB"],
];

function spanDays(first: string, last: string): number {
  return Math.round((dayMs(last) - dayMs(first)) / 864e5) + 1;
}

export function buildStorySlides(
  chat: ParsedChat,
  streaks: { longest: StreakSegment | null; current: StreakSegment | null },
): StorySlide[] {
  const { RAW, messages, names, chatTitle, HOURLY_BY_DAY } = chat;
  const slides: StorySlide[] = [];
  const add = (s: Omit<StorySlide, "bg">) => slides.push({ ...s, bg: STORY_BGS[slides.length % STORY_BGS.length] });
  if (!RAW.length) return slides;

  const title = chatTitle || `${names.a} ⇄ ${names.b}`;
  const first = RAW[0].date;
  const last = RAW[RAW.length - 1].date;
  const span = spanDays(first, last);
  let total = 0;
  let sumA = 0;
  let sumB = 0;
  let chars = 0;
  let peak = RAW[0];
  const wd = new Array(7).fill(0);
  for (const d of RAW) {
    total += d.total;
    sumA += d.a;
    sumB += d.b;
    chars += d.chars || 0;
    if (d.total > peak.total) peak = d;
    wd[weekdayOf(d.date)] += d.total;
  }
  const hours = new Array(24).fill(0);
  for (const h of HOURLY_BY_DAY) for (let i = 0; i < 24; i++) hours[i] += h.hours[i] || 0;
  const hourTotal = hours.reduce((s, v) => s + v, 0);
  const aShare = sumA + sumB === 0 ? 50 : Math.round((sumA / (sumA + sumB)) * 100);

  add({
    kind: "text",
    emoji: "💌",
    caption: "ふたりのトーク",
    title,
    sub: `${fmtDateJP(first)} 〜 ${fmtDateJP(last)}`,
    hint: "タップで次へ ／ 長押しで一時停止",
  });
  add({ kind: "text", emoji: "📅", caption: "トークを始めて", count: span, suffix: "日", sub: `そのうち ${fmtInt(RAW.length)}日 おしゃべりしました` });
  add({
    kind: "text",
    emoji: "💬",
    caption: "やりとりしたメッセージ",
    count: total,
    suffix: "件",
    sub: `1日平均 ${(total / RAW.length).toFixed(1)}件`,
  });
  if (chars > 0) {
    add({
      kind: "text",
      emoji: "📚",
      caption: "打った文字数",
      count: chars,
      suffix: "字",
      sub: `文庫本 およそ${Math.max(0.1, chars / 100000).toFixed(1)}冊分`,
    });
    const min = Math.round(chars / 50);
    add({
      kind: "text",
      emoji: "⏰",
      caption: "文字を打っていた時間のめやす",
      title: min >= 60 ? `約${Math.floor(min / 60)}時間${min % 60}分` : `約${min}分`,
      sub: "1分50字で計算しています",
    });
  }
  add({
    kind: "bar",
    emoji: "⚖️",
    caption: "おしゃべりの割合",
    rows: [
      { label: names.a, pct: aShare, count: sumA },
      { label: names.b, pct: 100 - aShare, count: sumB },
    ],
    sub: aShare === 50 ? "ぴったり半分ずつ！" : `${aShare > 50 ? names.a : names.b}のほうが少し多めです`,
  });
  add({ kind: "text", emoji: "🏆", caption: "いちばん盛り上がった日", title: fmtDateJP(peak.date), sub: `${fmtInt(peak.total)}件のやりとり` });
  const wdMax = wd.indexOf(Math.max(...wd));
  add({ kind: "text", emoji: "🗓️", caption: "いちばん話す曜日", title: `${WEEKDAY_LABELS[wdMax]}曜日`, sub: `${fmtInt(wd[wdMax])}件` });
  if (hourTotal > 0) {
    const ph = hours.indexOf(Math.max(...hours));
    add({
      kind: "text",
      emoji: ph >= 6 && ph < 18 ? "☀️" : "🌙",
      caption: "いちばん話す時間帯",
      title: `${ph}時台`,
      sub: `${fmtInt(hours[ph])}件`,
    });
    const night = Math.round(((hours[0] + hours[1] + hours[2] + hours[3] + hours[4] + hours[5]) / hourTotal) * 100);
    if (night >= 1) {
      add({
        kind: "text",
        emoji: "🦉",
        caption: "深夜（0〜5時）のメッセージ",
        count: night,
        suffix: "%",
        sub: night >= 15 ? "夜ふかしさんですね" : "ほどよく夜ふかし",
      });
    }
  }
  if (streaks.longest && streaks.longest.length > 0) {
    add({
      kind: "text",
      emoji: "🔥",
      caption: "最長の連続記録",
      count: streaks.longest.length,
      suffix: "日",
      sub: `${fmtDateShort(streaks.longest.start)} 〜 ${fmtDateShort(streaks.longest.end)}`,
    });
  }
  if (streaks.current && streaks.current.length > 1) {
    add({ kind: "text", emoji: "⚡", caption: "いまの連続記録", count: streaks.current.length, suffix: "日", sub: "この勢いを継続中！" });
  }
  const words = wordRanking(messages, 5);
  if (words.length >= 3) {
    add({ kind: "rank", emoji: "🗣️", caption: "よく使った言葉", items: words.map((w) => ({ label: w.word, value: w.count })) });
  }
  const emojis = emojiRanking(messages, 5);
  if (emojis.length >= 1) {
    add({ kind: "rank", emoji: "😆", caption: "よく使った絵文字", items: emojis.map((e) => ({ label: e.emoji, value: e.count })) });
  }
  const topic = hotConversation(messages, first);
  if (topic && topic.highlights.length) {
    add({ kind: "bubbles", emoji: "🔥", caption: "いちばん盛り上がった話", topic, names });
  }
  const ms = milestones(RAW);
  if (ms.anniversaryYears) add({ kind: "text", emoji: "🎂", caption: "記念日", title: `${ms.anniversaryYears}周年`, sub: "おめでとう！" });
  add({
    kind: "text",
    emoji: "✨",
    caption: "次の目標",
    title: `累計${fmtInt(ms.nextTarget)}日`,
    sub: ms.isExact ? "ちょうど今日たどりつきました！" : `あと${Math.max(0, ms.nextTarget - ms.distinctDays)}日でたどりつきます`,
  });
  add({
    kind: "finale",
    emoji: "🎉",
    caption: "ふり返りはここまで",
    title: "これからもよろしく！",
    sub: `${fmtInt(total)}件 ・ ${fmtInt(span)}日間 ・ ${title}`,
  });
  return slides;
}
