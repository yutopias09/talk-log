// 追加の分析：通話・○年前の今日・はじめての記録・空いた期間・年ごとのまとめ・
// 言葉の推移・口ぐせ・リンク集・会話のくせ・記念日
import { emojiRanking, isCountableWord, streakSegments, textForCounting, tokenize, URL_RE, wordRanking } from "./analytics";
import { dayMs } from "./parse";
import type { DayStat, Message, Names, ParsedChat } from "./types";

/* ------------------------------------------------------------------ */
/* 共通 */

export function lowerBound(messages: Message[], date: string): number {
  let lo = 0;
  let hi = messages.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (messages[mid].date < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function messagesOn(messages: Message[], date: string): Message[] {
  const out: Message[] = [];
  for (let i = lowerBound(messages, date); i < messages.length && messages[i].date === date; i++) out.push(messages[i]);
  return out;
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((dayMs(b) - dayMs(a)) / 864e5);
}

/** 秒を「1時間23分」「12分34秒」に */
export function fmtSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${r ? `${r}秒` : ""}`;
  return `${r}秒`;
}

/* ------------------------------------------------------------------ */
/* 通話 */

// LINEの書き出し：「☎ 通話時間 1:23:45」「☎ 通話時間 12:34」「☎ 不在着信」「☎ キャンセル」など
const CALL_DURATION_RE = /^\s*☎\s*通話時間\s*(?:(\d+):)?(\d{1,2}):(\d{2})/;
const CALL_MISSED_RE = /^\s*☎\s*(不在着信|キャンセル|通話をキャンセルしました|応答なし|発信をキャンセルしました)/;

export interface CallRecord {
  date: string;
  time: string;
  caller: string;
  sec: number;
}

export interface CallStats {
  calls: CallRecord[];
  missed: { date: string; time: string; caller: string }[];
  totalSec: number;
  longest: CallRecord[];
  byCaller: { name: string; count: number; sec: number }[];
  missedByCaller: { name: string; count: number }[];
  hours: number[];
  monthly: { ym: string; label: string; count: number; sec: number }[];
  weekday: number[];
}

export function callStats(messages: Message[], names: Names): CallStats {
  const calls: CallRecord[] = [];
  const missed: { date: string; time: string; caller: string }[] = [];
  for (const m of messages) {
    if (m.content.indexOf("☎") < 0) continue;
    const d = CALL_DURATION_RE.exec(m.content);
    if (d) {
      const sec = (d[1] ? parseInt(d[1], 10) * 3600 : 0) + parseInt(d[2], 10) * 60 + parseInt(d[3], 10);
      calls.push({ date: m.date, time: m.time, caller: m.sender, sec });
    } else if (CALL_MISSED_RE.test(m.content)) {
      missed.push({ date: m.date, time: m.time, caller: m.sender });
    }
  }
  const hours = new Array(24).fill(0);
  const weekday = new Array(7).fill(0);
  const monthMap = new Map<string, { count: number; sec: number }>();
  let totalSec = 0;
  for (const c of calls) {
    totalSec += c.sec;
    const h = parseInt(c.time.slice(0, 2), 10);
    if (h >= 0 && h < 24) hours[h]++;
    weekday[new Date(`${c.date}T00:00:00`).getDay()]++;
    const ym = c.date.slice(0, 7);
    const cur = monthMap.get(ym) || { count: 0, sec: 0 };
    cur.count++;
    cur.sec += c.sec;
    monthMap.set(ym, cur);
  }
  const byCaller = [names.a, names.b].map((name) => {
    const mine = calls.filter((c) => c.caller === name);
    return { name, count: mine.length, sec: mine.reduce((s, c) => s + c.sec, 0) };
  });
  const missedByCaller = [names.a, names.b].map((name) => ({ name, count: missed.filter((c) => c.caller === name).length }));
  const monthly = [...monthMap.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([ym, v]) => ({ ym, label: `${parseInt(ym.slice(0, 4), 10) % 100}/${parseInt(ym.slice(5, 7), 10)}`, ...v }));
  const longest = [...calls].sort((x, y) => y.sec - x.sec).slice(0, 5);
  return { calls, missed, totalSec, longest, byCaller, missedByCaller, hours, monthly, weekday };
}

/* ------------------------------------------------------------------ */
/* ○年前の今日 */

export interface OnThisDay {
  yearsAgo: number;
  date: string;
  total: number;
  messages: Message[];
}

export function onThisDay(chat: ParsedChat, today = localToday()): OnThisDay[] {
  const byDate = new Map(chat.RAW.map((d) => [d.date, d]));
  const out: OnThisDay[] = [];
  const y = parseInt(today.slice(0, 4), 10);
  const md = today.slice(5);
  for (let k = 1; k <= 15; k++) {
    let date = `${y - k}-${md}`;
    // うるう日は、ない年は2/28で
    if (md === "02-29" && !byDate.has(date)) date = `${y - k}-02-28`;
    const day = byDate.get(date);
    if (day) out.push({ yearsAgo: k, date, total: day.total, messages: messagesOn(chat.messages, date) });
  }
  return out;
}

/** ○ヶ月前の今日（1年分の記録がまだないときに使う） */
export function monthsAgoToday(chat: ParsedChat, today = localToday()): OnThisDay[] {
  const byDate = new Map(chat.RAW.map((d) => [d.date, d]));
  const out: OnThisDay[] = [];
  const y = parseInt(today.slice(0, 4), 10);
  const mo = parseInt(today.slice(5, 7), 10);
  const dd = today.slice(8);
  for (let k = 1; k <= 11; k++) {
    let yy = y;
    let mm = mo - k;
    while (mm <= 0) {
      mm += 12;
      yy -= 1;
    }
    const date = `${yy}-${String(mm).padStart(2, "0")}-${dd}`;
    const day = byDate.get(date);
    if (day) out.push({ yearsAgo: -k, date, total: day.total, messages: messagesOn(chat.messages, date) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* はじめての記録 */

export interface FirstMoment {
  key: string;
  label: string;
  emoji: string;
  message: Message | null;
}

export const DEFAULT_FIRST_WORDS = ["好き", "ありがとう", "おはよう", "おやすみ", "会いたい", "ごめん", "楽しかった", "おめでとう"];

export function firstMoments(messages: Message[], words: string[]): FirstMoment[] {
  const out: FirstMoment[] = [];
  const firstOfType = (pred: (m: Message) => boolean) => messages.find(pred) || null;
  out.push({ key: "first", label: "最初のメッセージ", emoji: "💌", message: messages[0] || null });
  out.push({ key: "photo", label: "最初の写真", emoji: "📷", message: firstOfType((m) => m.type === "photo") });
  out.push({ key: "stamp", label: "最初のスタンプ", emoji: "🐻", message: firstOfType((m) => m.type === "stamp") });
  out.push({ key: "call", label: "最初の通話", emoji: "📞", message: firstOfType((m) => CALL_DURATION_RE.test(m.content)) });
  const norm = (s: string) => s.normalize("NFKC").toLowerCase();
  for (const w of words) {
    const q = norm(w.trim());
    if (!q) continue;
    out.push({
      key: `w:${q}`,
      label: `はじめての「${w.trim()}」`,
      emoji: "✨",
      message: firstOfType((m) => m.type === "text" && !m.content.startsWith("☎") && norm(m.content).includes(q)),
    });
  }
  return out.filter((m) => m.message);
}

/* ------------------------------------------------------------------ */
/* いちばん空いた期間 */

export interface Gap {
  from: string; // 空く前の最後の日
  to: string; // 再開した日
  days: number; // 話さなかった日数
  before: Message | null;
  after: Message | null;
}

export function longestGaps(chat: ParsedChat, limit = 5): Gap[] {
  const { RAW, messages } = chat;
  const gaps: Gap[] = [];
  for (let i = 1; i < RAW.length; i++) {
    const days = daysBetween(RAW[i - 1].date, RAW[i].date) - 1;
    if (days >= 1) gaps.push({ from: RAW[i - 1].date, to: RAW[i].date, days, before: null, after: null });
  }
  gaps.sort((x, y) => y.days - x.days);
  return gaps.slice(0, limit).map((g) => {
    const startOfTo = lowerBound(messages, g.to);
    return { ...g, before: messages[startOfTo - 1] || null, after: messages[startOfTo] || null };
  });
}

/* ------------------------------------------------------------------ */
/* 年ごとのまとめ */

export interface YearSummary {
  year: string;
  total: number;
  days: number;
  a: number;
  b: number;
  chars: number;
  peak: DayStat;
  longestStreak: number;
  words: { word: string; count: number }[];
  emojis: { emoji: string; count: number }[];
  calls: number;
  callSec: number;
  firstDate: string;
  lastDate: string;
}

export function yearsOf(chat: ParsedChat): string[] {
  const set = new Set<string>();
  for (const d of chat.RAW) set.add(d.date.slice(0, 4));
  return [...set].sort();
}

/** 指定した年だけのトーク（ストーリーをその年で作るときに使う） */
export function chatForYear(chat: ParsedChat, year: string): ParsedChat {
  const RAW = chat.RAW.filter((d) => d.date.startsWith(year));
  const from = lowerBound(chat.messages, `${year}-01-01`);
  const to = lowerBound(chat.messages, `${Number(year) + 1}-01-01`);
  const messages = chat.messages.slice(from, to);
  return {
    ...chat,
    RAW,
    HOURLY_BY_DAY: chat.HOURLY_BY_DAY.filter((h) => h.date.startsWith(year)),
    messages,
    messageCount: messages.length,
    chatTitle: `${year}年のふたり`,
  };
}

export function yearSummary(chat: ParsedChat, year: string): YearSummary | null {
  const sub = chatForYear(chat, year);
  if (!sub.RAW.length) return null;
  let total = 0;
  let a = 0;
  let b = 0;
  let chars = 0;
  let peak = sub.RAW[0];
  for (const d of sub.RAW) {
    total += d.total;
    a += d.a;
    b += d.b;
    chars += d.chars || 0;
    if (d.total > peak.total) peak = d;
  }
  const segs = streakSegments(sub.RAW);
  const calls = callStats(sub.messages, chat.names);
  return {
    year,
    total,
    days: sub.RAW.length,
    a,
    b,
    chars,
    peak,
    longestStreak: segs.reduce((m, s) => Math.max(m, s.length), 0),
    words: wordRanking(sub.messages, 5),
    emojis: emojiRanking(sub.messages, 5),
    calls: calls.calls.length,
    callSec: calls.totalSec,
    firstDate: sub.RAW[0].date,
    lastDate: sub.RAW[sub.RAW.length - 1].date,
  };
}

/* ------------------------------------------------------------------ */
/* 言葉の推移 */

export interface WordTrend {
  word: string;
  months: { ym: string; label: string; a: number; b: number }[];
  totalA: number;
  totalB: number;
  first: Message | null;
  last: Message | null;
  peakMonth: string | null;
}

function countOccurrences(hay: string, needle: string): number {
  let n = 0;
  let i = hay.indexOf(needle);
  while (i >= 0) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

export function wordTrend(chat: ParsedChat, word: string): WordTrend | null {
  const q = word.normalize("NFKC").toLowerCase().trim();
  if (!q || !chat.RAW.length) return null;
  const monthMap = new Map<string, { a: number; b: number }>();
  // 期間中のすべての月を0で用意しておく（使っていない月も見えるように）
  const firstYm = chat.RAW[0].date.slice(0, 7);
  const lastYm = chat.RAW[chat.RAW.length - 1].date.slice(0, 7);
  let [yy, mm] = firstYm.split("-").map(Number);
  for (let guard = 0; guard < 600; guard++) {
    const ym = `${yy}-${String(mm).padStart(2, "0")}`;
    monthMap.set(ym, { a: 0, b: 0 });
    if (ym === lastYm) break;
    mm++;
    if (mm > 12) {
      mm = 1;
      yy++;
    }
  }
  let totalA = 0;
  let totalB = 0;
  let first: Message | null = null;
  let last: Message | null = null;
  for (const m of chat.messages) {
    if (m.type !== "text") continue;
    const text = textForCounting(m.content);
    if (!text) continue;
    const n = countOccurrences(text.normalize("NFKC").toLowerCase(), q);
    if (!n) continue;
    if (!first) first = m;
    last = m;
    const cur = monthMap.get(m.date.slice(0, 7));
    if (m.sender === chat.names.a) {
      totalA += n;
      if (cur) cur.a += n;
    } else {
      totalB += n;
      if (cur) cur.b += n;
    }
  }
  const months = [...monthMap.entries()].map(([ym, v]) => ({
    ym,
    label: `${parseInt(ym.slice(0, 4), 10) % 100}/${parseInt(ym.slice(5, 7), 10)}`,
    ...v,
  }));
  let peakMonth: string | null = null;
  let best = 0;
  for (const m of months) {
    if (m.a + m.b > best) {
      best = m.a + m.b;
      peakMonth = m.ym;
    }
  }
  return { word: word.trim(), months, totalA, totalB, first, last, peakMonth };
}

/* ------------------------------------------------------------------ */
/* ふたりの口ぐせ（相手より自分のほうが特によく使う言葉） */

export interface Signature {
  word: string;
  mine: number;
  theirs: number;
}

export function signatureWords(messages: Message[], names: Names, limit = 8): { a: Signature[]; b: Signature[] } {
  const ca = new Map<string, number>();
  const cb = new Map<string, number>();
  let na = 0;
  let nb = 0;
  for (const m of messages) {
    if (m.type !== "text") continue;
    const isA = m.sender === names.a;
    const map = isA ? ca : cb;
    for (const w of tokenize(textForCounting(m.content))) {
      if (!isCountableWord(w)) continue;
      map.set(w, (map.get(w) || 0) + 1);
      if (isA) na++;
      else nb++;
    }
  }
  const vocab = new Set([...ca.keys(), ...cb.keys()]);
  const V = Math.max(1, vocab.size);
  const alpha = 0.5;
  const scored: { word: string; score: number; a: number; b: number }[] = [];
  for (const w of vocab) {
    const a = ca.get(w) || 0;
    const b = cb.get(w) || 0;
    if (a + b < 3) continue;
    // 出てくる割合の差（少ない語で極端にならないよう、ならしてから対数で比べる）
    const pa = (a + alpha) / (na + alpha * V);
    const pb = (b + alpha) / (nb + alpha * V);
    const score = Math.log(pa / pb) * Math.sqrt(a + b);
    scored.push({ word: w, score, a, b });
  }
  const forA = scored
    .filter((s) => s.score > 0 && s.a >= 3)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((s) => ({ word: s.word, mine: s.a, theirs: s.b }));
  const forB = scored
    .filter((s) => s.score < 0 && s.b >= 3)
    .sort((x, y) => x.score - y.score)
    .slice(0, limit)
    .map((s) => ({ word: s.word, mine: s.b, theirs: s.a }));
  return { a: forA, b: forB };
}

/* ------------------------------------------------------------------ */
/* 共有したリンク */

export interface SharedLink {
  url: string;
  domain: string;
  kind: string;
  date: string;
  time: string;
  sender: string;
}

function linkKind(domain: string): string {
  if (/youtube\.com|youtu\.be/.test(domain)) return "YouTube";
  if (/instagram\.com/.test(domain)) return "Instagram";
  if (/(^|\.)x\.com|twitter\.com/.test(domain)) return "X";
  if (/tiktok\.com/.test(domain)) return "TikTok";
  if (/tabelog\.com|hotpepper|retty\.me|gurunavi/.test(domain)) return "お店";
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/.test(domain)) return "地図";
  if (/amazon\.|rakuten\.|mercari|zozo/.test(domain)) return "買い物";
  if (/spotify\.com|music\.apple\.com|music\.youtube/.test(domain)) return "音楽";
  return "その他";
}

export function sharedLinks(messages: Message[]): SharedLink[] {
  const out: SharedLink[] = [];
  for (const m of messages) {
    if (m.content.indexOf("http") < 0) continue;
    const found = m.content.match(URL_RE);
    if (!found) continue;
    for (const raw of found) {
      const url = raw.replace(/[.,!?！？。、]+$/, "");
      let domain = "";
      try {
        const u = new URL(url);
        domain = u.hostname.replace(/^www\./, "");
        if (domain.startsWith("google.") && u.pathname.startsWith("/maps")) domain = `${domain}/maps`;
      } catch {
        continue;
      }
      out.push({ url, domain, kind: linkKind(domain), date: m.date, time: m.time, sender: m.sender });
    }
  }
  return out.reverse();
}

/* ------------------------------------------------------------------ */
/* 会話のくせ */

export interface Habits {
  sessions: number;
  starters: { name: string; count: number }[];
  enders: { name: string; count: number }[];
  morning: { name: string; count: number }[];
  night: { name: string; count: number }[];
  burst: { name: string; avg: number }[];
}

const MORNING_RE = /おは(よう|よ|ー|〜)|good ?morning/i;
const NIGHT_RE = /おやす|good ?night/i;

/** 3時間以上あいたら「新しい会話」として数える */
export function conversationHabits(messages: Message[], names: Names, gapMinutes = 180): Habits {
  const start = new Map<string, number>([
    [names.a, 0],
    [names.b, 0],
  ]);
  const end = new Map(start);
  const morning = new Map(start);
  const night = new Map(start);
  const runs = new Map<string, { runs: number; msgs: number }>([
    [names.a, { runs: 0, msgs: 0 }],
    [names.b, { runs: 0, msgs: 0 }],
  ]);
  let sessions = 0;
  let morningDay = "";
  let nightDay = "";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    if (!prev || m.t - prev.t >= gapMinutes) {
      sessions++;
      if (start.has(m.sender)) start.set(m.sender, (start.get(m.sender) || 0) + 1);
    }
    if (!next || next.t - m.t >= gapMinutes) {
      if (end.has(m.sender)) end.set(m.sender, (end.get(m.sender) || 0) + 1);
    }
    if (m.type === "text") {
      // その日いちばん先に「おはよう」「おやすみ」を言った人
      if (m.date !== morningDay && MORNING_RE.test(m.content)) {
        morningDay = m.date;
        if (morning.has(m.sender)) morning.set(m.sender, (morning.get(m.sender) || 0) + 1);
      }
      if (m.date !== nightDay && NIGHT_RE.test(m.content)) {
        nightDay = m.date;
        if (night.has(m.sender)) night.set(m.sender, (night.get(m.sender) || 0) + 1);
      }
    }
    const r = runs.get(m.sender);
    if (r) {
      r.msgs++;
      if (!prev || prev.sender !== m.sender || m.t - prev.t >= gapMinutes) r.runs++;
    }
  }
  const list = (map: Map<string, number>) => [names.a, names.b].map((name) => ({ name, count: map.get(name) || 0 }));
  return {
    sessions,
    starters: list(start),
    enders: list(end),
    morning: list(morning),
    night: list(night),
    burst: [names.a, names.b].map((name) => {
      const r = runs.get(name)!;
      return { name, avg: r.runs ? r.msgs / r.runs : 0 };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 記念日 */

export interface Anniversary {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  yearly: boolean;
}

export interface AnniversaryStatus extends Anniversary {
  next: string;
  daysUntil: number;
  /** 始まりの日から今日まで何日目か（始まりの日 = 1日目） */
  dayCount: number;
  /** 次で何回目（何周年）か */
  nth: number;
}

export function anniversaryStatus(a: Anniversary, today = localToday()): AnniversaryStatus {
  const dayCount = daysBetween(a.date, today) + 1;
  let next = a.date;
  let nth = 0;
  if (a.yearly) {
    const md = a.date.slice(5);
    const startYear = parseInt(a.date.slice(0, 4), 10);
    let y = parseInt(today.slice(0, 4), 10);
    next = `${y}-${md}`;
    if (next < today) {
      y += 1;
      next = `${y}-${md}`;
    }
    nth = y - startYear;
  }
  return { ...a, next, daysUntil: daysBetween(today, next), dayCount, nth };
}

/** 「○日目」の記念日（100日・200日・365日・500日・1000日…）で次に来るもの */
export function nextDayMilestone(dayCount: number): { days: number; inDays: number } {
  const marks = [100, 200, 300, 365, 500, 700, 730, 1000, 1095, 1500, 2000, 2500, 3000, 4000, 5000];
  for (const d of marks) if (d >= dayCount) return { days: d, inDays: d - dayCount };
  const d = Math.ceil((dayCount + 1) / 1000) * 1000;
  return { days: d, inDays: d - dayCount };
}
