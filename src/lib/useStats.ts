import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bestWeekday,
  busiestHour,
  hourlyTotals,
  rangeStartDate,
  rangeSummary,
  sliceByRange,
  streakSegments,
  weekdayTotals,
  weeklyReport,
  withDeltas,
} from "./analytics";
import type { Message, ParsedChat, RangeKey } from "./types";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "talklog-theme";

export function useTheme(): [ThemeMode, () => void] {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#090b11" : "#f5f6fa");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}

export function useChatStats(chat: ParsedChat, rangeKey: RangeKey) {
  const rawWithDelta = useMemo(() => withDeltas(chat.RAW), [chat.RAW]);
  const sliced = useMemo(() => sliceByRange(rawWithDelta, rangeKey), [rawWithDelta, rangeKey]);
  const summary = useMemo(() => rangeSummary(sliced), [sliced]);
  const hourly = useMemo(() => hourlyTotals(sliced, chat.HOURLY_BY_DAY), [sliced, chat.HOURLY_BY_DAY]);
  const weekday = useMemo(() => weekdayTotals(sliced), [sliced]);
  const streaks = useMemo(() => streakSegments(chat.RAW), [chat.RAW]);
  const weekly = useMemo(() => weeklyReport(rawWithDelta), [rawWithDelta]);
  const startDate = useMemo(() => rangeStartDate(chat.RAW, rangeKey), [chat.RAW, rangeKey]);

  const currentStreak = streaks.length ? streaks[streaks.length - 1] : null;
  const longestStreak = streaks.reduce(
    (best, s) => (s.length > best.length ? s : best),
    streaks[0] || { start: "", end: "", length: 0 },
  );
  const topStreaks = useMemo(
    () => [...streaks].sort((x, y) => y.length - x.length).slice(0, 5),
    [streaks],
  );

  const messagesInRange = useMemo(() => {
    let lo = 0;
    let hi = chat.messages.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (chat.messages[mid].date < startDate) lo = mid + 1;
      else hi = mid;
    }
    return chat.messages.slice(lo);
  }, [chat.messages, startDate]);

  const trend = useMemo(
    () =>
      sliced.map((d) => ({
        label: `${parseInt(d.date.slice(5, 7), 10)}/${parseInt(d.date.slice(8, 10), 10)}`,
        value: d.total,
        title: `${parseInt(d.date.slice(5, 7), 10)}月${parseInt(d.date.slice(8, 10), 10)}日（${"日月火水木金土"[new Date(`${d.date}T00:00:00`).getDay()]}）`,
        detail: `前日比 ${d.dayDelta >= 0 ? "+" : ""}${d.dayDelta}`,
        rows: [
          { label: chat.names.a, value: `${d.a}`, color: "var(--a)" },
          { label: chat.names.b, value: `${d.b}`, color: "var(--b)" },
        ],
      })),
    [sliced, chat.names],
  );

  return {
    rawWithDelta,
    sliced,
    summary,
    hourly,
    weekday,
    streaks,
    currentStreak,
    longestStreak,
    topStreaks,
    weekly,
    startDate,
    messagesInRange,
    trend,
    peakHour: busiestHour(hourly),
    topWeekday: bestWeekday(weekday),
  };
}

export function useStoredState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set];
}

export function filterMessages(
  messages: Message[],
  opts: { query?: string; sender?: string | "all"; type?: string | "all" },
): Message[] {
  const q = (opts.query || "").trim().toLowerCase();
  return messages.filter((m) => {
    if (opts.sender && opts.sender !== "all" && m.sender !== opts.sender) return false;
    if (opts.type && opts.type !== "all" && m.type !== opts.type) return false;
    if (q && !m.content.toLowerCase().includes(q)) return false;
    return true;
  });
}
