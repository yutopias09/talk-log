import type { DayStat, HourlyDay, Message, MsgType, ParsedChat } from "./types";

const DATE_RE = /^(\d{4})\/(\d{2})\/(\d{2})\(.\)\s*$/;
const MSG_RE = /^(\d{2}):(\d{2})\t([^\t]+)\t(.*)$/;

/** Date lines, with or without a weekday: `2023/07/31(月)`, `2025.12.06 土曜日`. */
const DATE_LOOSE_RE = /^(\d{4})[./-](\d{2})[./-](\d{2})(?:\(.\)|[ \t]+.*)?\s*$/;
/** `午後05:40<TAB>名前<TAB>本文` (12-hour clock, tab separated). */
const MSG_JP_TAB_RE = /^(午前|午後)\s*(\d{1,2}):(\d{2})\t([^\t]+)\t(.*)$/;
/** `05:40<TAB>名前<TAB>本文` */
const MSG_TAB_RE = /^(\d{1,2}):(\d{2})\t([^\t]+)\t(.*)$/;
/** `午後5:40 名前 本文` (12-hour clock, space separated). */
const MSG_JP_SPACED_RE = /^(午前|午後)\s*(\d{1,2}):(\d{2})[ \t]+(\S+)(?:[ \t]+(.*))?$/;
/** `21:09 名前 本文` */
const MSG_SPACED_RE = /^(\d{1,2}):(\d{2})[ \t]+(\S+)(?:[ \t]+(.*))?$/;

/** Chat notices that should not count as messages. */
const SYSTEM_NOTICE_RE =
  /メッセージの送信を取り消しました|トークを通話に切り替えました|通話が終了しました/;

const TYPE_MARKERS: Record<string, MsgType> = {
  "[スタンプ]": "stamp",
  "[写真]": "photo",
  "[動画]": "video",
  "[ファイル]": "file",
  "[アルバム]": "file",
  "[位置情報]": "other",
  "[音声メッセージ]": "other",
  "[ノート]": "other",
};
const MARKER_SET = new Set(Object.keys(TYPE_MARKERS));

/** LINE's exported text may start with a UTF-8 BOM; strip it or the first line breaks. */
export function normalizeSource(text: string): string {
  return text.replace(/^﻿/, "");
}

function isLineWhitespace(code: number): boolean {
  return (
    code === 32 ||
    (code >= 9 && code <= 13) ||
    code === 160 ||
    code === 5760 ||
    (code >= 8192 && code <= 8202) ||
    code === 8232 ||
    code === 8233 ||
    code === 8239 ||
    code === 8287 ||
    code === 12288 ||
    code === 65279
  );
}

const dateCache = new Map<string, number>();
/** UTC midnight of a YYYY-MM-DD string, in ms. */
export function dayMs(date: string): number {
  let v = dateCache.get(date);
  if (v === undefined) {
    const [y, m, d] = date.split("-").map(Number);
    v = Date.UTC(y, m - 1, d);
    dateCache.set(date, v);
  }
  return v;
}

/** UTC weekday (0=Sun) for a YYYY-MM-DD string. */
const weekdayCache = new Map<string, number>();
export function weekdayOf(date: string): number {
  let v = weekdayCache.get(date);
  if (v === undefined) {
    v = new Date(dayMs(date)).getUTCDay();
    weekdayCache.set(date, v);
  }
  return v;
}

export function addDays(date: string, n: number): string {
  return new Date(dayMs(date) + n * 864e5).toISOString().slice(0, 10);
}

export function minutesSinceEpoch(m: Message): number {
  if (m.t !== undefined) return m.t;
  return (
    dayMs(m.date) / 6e4 +
    parseInt(m.time.slice(0, 2), 10) * 60 +
    parseInt(m.time.slice(3, 5), 10)
  );
}

interface DayAccumulator {
  total: number;
  bySender: Map<string, number>;
  chars: number;
  hours: number[];
}

interface Accumulator {
  perDay: Map<string, DayAccumulator>;
  perSender: Map<string, number>;
  messages: Message[];
  currentDate: string | null;
  setDate: (m: RegExpExecArray) => void;
  push: (time: string, hour: number, minute: number, sender: string, rawContent: string) => void;
  build: (chatTitle: string | null) => ParsedChat | null;
}

function createAccumulator(): Accumulator {
  const perDay = new Map<string, DayAccumulator>();
  const perSender = new Map<string, number>();
  const messages: Message[] = [];

  let currentDate: string | null = null;
  let currentDay: DayAccumulator | null = null;
  let dayOffset = 0;

  const push = (time: string, hour: number, minute: number, sender: string, rawContent: string) => {
    const first = rawContent.charCodeAt(0);
    const content = first > 32 && first < 160 ? rawContent : rawContent.trim();
    const marked = content.charCodeAt(0) === 91;
    const type: MsgType = (marked && TYPE_MARKERS[content]) || "text";

    if (!currentDay) {
      currentDay = { total: 0, bySender: new Map(), chars: 0, hours: new Array(24).fill(0) };
      perDay.set(currentDate!, currentDay);
    }
    const day = currentDay;

    day.total += 1;
    day.bySender.set(sender, (day.bySender.get(sender) || 0) + 1);
    if (hour >= 0 && hour < 24) day.hours[hour] += 1;

    if (!(marked && MARKER_SET.has(content))) {
      let len = content.length;
      for (let i = 0; i < content.length; i++) {
        const c = content.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff) len--;
      }
      day.chars += len;
    }

    perSender.set(sender, (perSender.get(sender) || 0) + 1);
    messages.push({
      date: currentDate!,
      time,
      sender,
      content,
      type,
      t: dayOffset + hour * 60 + minute,
    });
  };

  const setDate = (m: RegExpExecArray) => {
    currentDate = `${m[1]}-${m[2]}-${m[3]}`;
    currentDay = perDay.get(currentDate) || null;
    dayOffset = dayMs(currentDate) / 6e4;
  };

  const build = (chatTitle: string | null): ParsedChat | null => {
    const dates = [...perDay.keys()].sort();
    if (dates.length === 0) return null;

    const ranked = [...perSender.entries()].sort((x, y) => y[1] - x[1]).map(([name]) => name);
    const nameA = ranked[0] || "A";
    const nameB = ranked[1] || "B";

    const RAW: DayStat[] = dates.map((date) => {
      const d = perDay.get(date)!;
      return {
        date,
        total: d.total,
        a: d.bySender.get(nameA) || 0,
        b: d.bySender.get(nameB) || 0,
        chars: d.chars,
      };
    });
    const HOURLY_BY_DAY: HourlyDay[] = dates.map((date) => ({
      date,
      hours: perDay.get(date)!.hours,
    }));

    return {
      RAW,
      HOURLY_BY_DAY,
      names: { a: nameA, b: nameB },
      chatTitle,
      messageCount: RAW.reduce((sum, d) => sum + d.total, 0),
      messages,
    };
  };

  return {
    perDay,
    perSender,
    messages,
    get currentDate() {
      return currentDate;
    },
    setDate,
    push,
    build,
  };
}

function titleFromText(text: string): string | null {
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0] || "";
  const m = /^\[LINE\]\s*(.+?)とのトーク履歴/.exec(firstLine.replace(/﻿/g, ""));
  return m ? m[1].trim() : null;
}

/**
 * Standard LINE export: tab separated, dates like `2025/12/06(土)`.
 * Uses the fast single-pass path when the text has consistent line endings.
 */
function parseStandard(text: string, acc: Accumulator): ParsedChat | null {
  const hasLoneCR = /\r/.test(text) && !/\r\n/.test(text);
  const simple =
    !hasLoneCR &&
    text.indexOf(String.fromCharCode(0x2028)) < 0 &&
    text.indexOf(String.fromCharCode(0x2029)) < 0;

  if (simple) {
    const total = text.length;
    const senderCache: string[] = [];
    let tabHint = -1;
    let pos = 0;

    while (pos <= total) {
      const start = pos;
      let end = text.indexOf("\n", pos);
      if (end < 0) end = total;
      pos = end + 1;

      let trimEnd = end;
      while (trimEnd > start) {
        const code = text.charCodeAt(trimEnd - 1);
        if (code > 32 && code < 160) break;
        if (isLineWhitespace(code)) trimEnd--;
        else break;
      }
      const len = trimEnd - start;
      if (len === 0) continue;

      if (len > 2 && text.charCodeAt(start + 2) === 58) {
        // "HH:" — message line
        if (acc.currentDate === null || len < 8) continue;
        const h1 = text.charCodeAt(start) - 48;
        const h2 = text.charCodeAt(start + 1) - 48;
        const m1 = text.charCodeAt(start + 3) - 48;
        const m2 = text.charCodeAt(start + 4) - 48;
        if (
          h1 < 0 || h1 > 9 ||
          h2 < 0 || h2 > 9 ||
          m1 < 0 || m1 > 9 ||
          m2 < 0 || m2 > 9 ||
          text.charCodeAt(start + 5) !== 9
        ) {
          continue;
        }
        if (tabHint < start + 6) {
          tabHint = text.indexOf("\t", start + 6);
          if (tabHint < 0) tabHint = total + 1;
        }
        const tab = tabHint;
        if (tab <= start + 6 || tab >= trimEnd) continue;
        const senderLen = tab - start - 6;
        let sender: string | null = null;
        for (let i = 0; i < senderCache.length; i++) {
          const s = senderCache[i];
          if (s.length === senderLen && text.startsWith(s, start + 6)) {
            sender = s;
            break;
          }
        }
        if (sender === null) {
          sender = text.slice(start + 6, tab);
          if (senderCache.length < 8) senderCache.push(sender);
        }
        acc.push(
          text.slice(start, start + 5),
          h1 * 10 + h2,
          m1 * 10 + m2,
          sender,
          text.slice(tab + 1, trimEnd),
        );
      } else if (len === 13) {
        const dm = DATE_RE.exec(text.slice(start, trimEnd));
        if (dm) acc.setDate(dm);
      }
    }
  } else {
    const lines = text.split(/\r\n|\r|\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      if (line.length === 0) continue;
      if (line.charCodeAt(2) !== 58) {
        const dm = DATE_RE.exec(line);
        if (dm) acc.setDate(dm);
        continue;
      }
      const mm = MSG_RE.exec(line);
      if (mm && acc.currentDate !== null) {
        acc.push(`${mm[1]}:${mm[2]}`, parseInt(mm[1], 10), parseInt(mm[2], 10), mm[3], mm[4]);
      }
    }
  }

  return acc.build(titleFromText(text));
}

function to24Hour(period: string | undefined, hourText: string, minuteText: string) {
  let hour = parseInt(hourText, 10);
  const minute = parseInt(minuteText, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return null;
  if (period === "午後" && hour < 12) hour += 12;
  if (period === "午前" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return null;
  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour,
    minute,
  };
}

/**
 * Line-based fallback for export variants:
 *  - tab separated with a 12-hour clock: 午後05:40\t名前\t本文
 *  - tab separated with a 24-hour clock: 05:40\t名前\t本文
 *  - space separated: 21:09 名前 本文 / 午後5:40 名前 本文
 *  - dates like 2023/07/31(月) or 2025.12.06 土曜日
 */
function parseLoose(text: string, acc: Accumulator): ParsedChat | null {
  const lines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (line.length === 0) continue;

    const dm = DATE_LOOSE_RE.exec(line);
    if (dm) {
      acc.setDate(dm);
      continue;
    }
    if (acc.currentDate === null) continue;

    let time: { time: string; hour: number; minute: number } | null = null;
    let sender = "";
    let content: string | undefined;

    let m = MSG_JP_TAB_RE.exec(line);
    if (m) {
      time = to24Hour(m[1], m[2], m[3]);
      sender = m[4];
      content = m[5];
    } else if ((m = MSG_TAB_RE.exec(line))) {
      time = to24Hour(undefined, m[1], m[2]);
      sender = m[3];
      content = m[4];
    } else if ((m = MSG_JP_SPACED_RE.exec(line))) {
      time = to24Hour(m[1], m[2], m[3]);
      sender = m[4];
      content = m[5];
    } else if ((m = MSG_SPACED_RE.exec(line))) {
      time = to24Hour(undefined, m[1], m[2]);
      sender = m[3];
      content = m[4];
    }

    if (!time || !sender) continue;
    // Lines like "21:12 Nutsがメッセージの送信を取り消しました" are notices,
    // not messages from a participant.
    if (!content || SYSTEM_NOTICE_RE.test(content)) continue;
    acc.push(time.time, time.hour, time.minute, sender, content);
  }

  return acc.build(titleFromText(text));
}

/**
 * Parses a LINE "トーク履歴" text export.
 * Supports the standard tab-separated format and the space-separated
 * `YYYY.MM.DD 曜日` variant. Returns null when no dated message was found.
 */
export function parseLineChat(input: string): ParsedChat | null {
  const text = normalizeSource(input);
  const standard = parseStandard(text, createAccumulator());
  // Prefer the canonical tab parser when it found messages; the loose parser is
  // only needed for the 12-hour and space-separated variants.
  if (standard) return standard;
  return parseLoose(text, createAccumulator());
}
