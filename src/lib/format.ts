import { WEEKDAY_LABELS } from "./analytics";
import { weekdayOf } from "./parse";

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("ja-JP");
}

export function fmtNum(n: number, digits = 1): string {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtDateShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export function fmtDateJP(date: string): string {
  const [, m, d] = date.split("-");
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

export function fmtDateFull(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日（${WEEKDAY_LABELS[weekdayOf(date)]}）`;
}

export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

export function fmtWeekday(date: string): string {
  return WEEKDAY_LABELS[weekdayOf(date)];
}

export function fmtDuration(minutes: number): string {
  if (!isFinite(minutes)) return "—";
  if (minutes < 1) return "1分未満";
  if (minutes < 60) return `${Math.round(minutes)}分`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}時間`;
  return `${(minutes / 1440).toFixed(1)}日`;
}

export function fmtRange(start: string, end: string): string {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (startYear !== endYear) {
    return `${startYear}年${fmtDateJP(start)} 〜 ${endYear}年${fmtDateJP(end)}`;
  }
  return `${fmtDateJP(start)} 〜 ${fmtDateJP(end)}`;
}

export function fmtPct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

/** Text length in the same way LINE users think of it: emoji count as one character. */
export function textLength(s: string): number {
  return Array.from(s).length;
}
