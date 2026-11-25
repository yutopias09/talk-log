import { useEffect, useMemo, useRef, useState } from "react";
import { MiniBars } from "../components/charts";
import { Icon } from "../components/Icon";
import { Card, CardHead, EmptyState, Segmented } from "../components/ui";
import { WEEKDAY_LABELS } from "../lib/analytics";
import { playTick, vibrate } from "../lib/feedback";
import { fmtDateJP, fmtInt, fmtWeekday } from "../lib/format";
import { weekdayOf } from "../lib/parse";
import { downloadBlob } from "../lib/share";
import { useStoredState } from "../lib/useStats";
import type { DayStat, Message } from "../lib/types";
import type { ViewProps } from "./types";

type SortKey = "new" | "old" | "most";
type WhoKey = "all" | "a" | "b";

interface DayNotes {
  fav: string[];
  memo: Record<string, string>;
}

function lowerBound(arr: Message[], date: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].date < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function HistoryView({ chat, stats }: ViewProps) {
  const { sliced } = stats;
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<WhoKey>("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [favOnly, setFavOnly] = useState(false);
  const [limit, setLimit] = useState(40);
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // お気に入りとメモは、トークごとにこの端末へ保存する
  const notesKey = `talklog-notes:${chat.chatTitle || ""}:${chat.names.a}:${chat.names.b}`;
  const [notes, setNotes] = useStoredState<DayNotes>(notesKey, { fav: [], memo: {} });
  const favSet = useMemo(() => new Set(notes.fav || []), [notes.fav]);
  const memo = notes.memo || {};
  const [memoDraft, setMemoDraft] = useState("");

  const sender = who === "a" ? chat.names.a : who === "b" ? chat.names.b : null;
  const allDays = chat.RAW;
  const dayIndex = useMemo(() => new Map(allDays.map((d) => [d.date, d])), [allDays]);

  const hourlyMap = useMemo(
    () => new Map(chat.HOURLY_BY_DAY.map((h) => [h.date, h.hours])),
    [chat.HOURLY_BY_DAY],
  );

  const q = query.trim().toLowerCase();
  const matchedDays = useMemo(() => {
    if (!q && !sender) return null;
    const set = new Set<string>();
    for (const m of stats.messagesInRange) {
      if (sender && m.sender !== sender) continue;
      if (q && !m.content.toLowerCase().includes(q)) continue;
      set.add(m.date);
    }
    return set;
  }, [stats.messagesInRange, sender, q]);

  const rows = useMemo(() => {
    // お気に入りは期間に関係なく、これまでの全部から集める
    let base: DayStat[] = favOnly ? allDays.filter((d) => favSet.has(d.date)) : sliced;
    if (matchedDays) base = base.filter((d) => matchedDays.has(d.date));
    const arr = [...base];
    if (sort === "new") arr.sort((a, b) => (a.date < b.date ? 1 : -1));
    else if (sort === "old") arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    else arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [sliced, allDays, matchedDays, favOnly, favSet, sort]);

  // 選んだ日のメッセージは、期間や絞り込みに関係なくその日の全部を見せる
  const selectedMessages = useMemo(() => {
    if (!selected) return [];
    const from = lowerBound(chat.messages, selected);
    const out: Message[] = [];
    for (let i = from; i < chat.messages.length && chat.messages[i].date === selected; i++) out.push(chat.messages[i]);
    return out;
  }, [chat.messages, selected]);

  useEffect(() => {
    setMemoDraft(selected ? memo[selected] || "" : "");
  }, [selected]);

  const openDay = (date: string, scroll: boolean) => {
    setSelected(date);
    if (scroll) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const toggleFav = (date: string) => {
    const next = favSet.has(date) ? (notes.fav || []).filter((d) => d !== date) : [...(notes.fav || []), date];
    setNotes({ fav: next, memo });
    playTick(favSet.has(date) ? 523.25 : 783.99, 0.06);
    vibrate(8);
  };

  const saveMemo = (date: string, text: string) => {
    const nextMemo = { ...memo };
    if (text.trim()) nextMemo[date] = text;
    else delete nextMemo[date];
    setNotes({ fav: notes.fav || [], memo: nextMemo });
  };

  // 思い出：これまでのトークから、ランダムに1日を選ぶ（メッセージが多めの日ほど選ばれやすい）
  const randomMemory = () => {
    if (!allDays.length) return;
    const weights = allDays.map((d) => Math.sqrt(d.total));
    const sum = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * sum;
    let pick = allDays[allDays.length - 1].date;
    for (let i = 0; i < allDays.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = allDays[i].date;
        break;
      }
    }
    playTick(880, 0.07);
    vibrate(10);
    openDay(pick, true);
  };

  const jumpTo = (date: string) => {
    if (!date) return;
    // その日に記録がなければ、いちばん近いトークした日へ
    let target = date;
    if (!dayIndex.has(date)) {
      let best = allDays[0].date;
      let bestGap = Infinity;
      const t = new Date(`${date}T00:00:00`).getTime();
      for (const d of allDays) {
        const gap = Math.abs(new Date(`${d.date}T00:00:00`).getTime() - t);
        if (gap < bestGap) {
          bestGap = gap;
          best = d.date;
        }
      }
      target = best;
    }
    openDay(target, true);
  };

  const exportCsv = () => {
    const head = ["日付", "曜日", "メッセージ数", chat.names.a, chat.names.b, "文字数", "お気に入り", "メモ"];
    const lines = [head.map(csvCell).join(",")];
    for (const d of allDays) {
      lines.push(
        [d.date, WEEKDAY_LABELS[weekdayOf(d.date)], d.total, d.a, d.b, d.chars || 0, favSet.has(d.date) ? "★" : "", memo[d.date] || ""]
          .map(csvCell)
          .join(","),
      );
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const name = (chat.chatTitle || `${chat.names.a}_${chat.names.b}`).replace(/[\\/:*?"<>|]/g, "_");
    downloadBlob(blob, `${name}_日別データ.csv`);
  };

  const filtered = !!(q || sender || favOnly);
  const first = allDays[0]?.date;
  const last = allDays[allDays.length - 1]?.date;

  return (
    <div className="stack">
      <Card>
        <CardHead
          title="日別のやりとり"
          sub={`${rows.length} 日を表示中${filtered ? "（絞り込み中）" : ""}`}
          icon="history"
          right={
            <Segmented
              options={[
                { key: "new", label: "新しい順" },
                { key: "old", label: "古い順" },
                { key: "most", label: "多い順" },
              ]}
              value={sort}
              onChange={setSort}
              ariaLabel="並び順"
              small
            />
          }
        />

        <div className="history-tools">
          <button type="button" className="btn btn-accent" onClick={randomMemory}>
            <Icon name="sparkles" size={15} />
            思い出をひらく
          </button>
          <button type="button" className="btn" aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>
            <Icon name="heart" size={15} filled={favOnly} />
            お気に入りのみ{favSet.size ? `（${favSet.size}）` : ""}
          </button>
          <label className="history-jump">
            <Icon name="calendar" size={15} />
            <span className="visually-hidden">日付にジャンプ</span>
            <input
              className="input"
              type="date"
              min={first}
              max={last}
              onChange={(e) => jumpTo(e.target.value)}
              aria-label="日付にジャンプ"
            />
          </label>
          <button type="button" className="btn btn-ghost" onClick={exportCsv} title="日ごとの件数・お気に入り・メモをCSVで保存">
            <Icon name="download" size={15} />
            CSV
          </button>
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <div className="search-box" style={{ flex: "1 1 220px" }}>
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              placeholder="この日のメッセージを絞り込む"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="メッセージを絞り込む"
            />
          </div>
          <Segmented
            options={[
              { key: "all", label: "全員" },
              { key: "a", label: chat.names.a },
              { key: "b", label: chat.names.b },
            ]}
            value={who}
            onChange={setWho}
            ariaLabel="送信者で絞り込む"
            small
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={favOnly ? "heart" : "search"} title={favOnly ? "お気に入りの日はまだありません" : "条件に合う日がありません"}>
            {favOnly ? "日付を開いて「お気に入り」を押すと、ここに集まります。" : "検索語や送信者を変えてみてください。"}
          </EmptyState>
        ) : (
          <>
            <div className="day-list">
              {rows.slice(0, limit).map((d) => {
                const hours = hourlyMap.get(d.date) || new Array(24).fill(0);
                const isSel = selected === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    className="day-row"
                    style={isSel ? { borderColor: "var(--a)", background: "var(--a-soft)" } : undefined}
                    onClick={() => (isSel ? setSelected(null) : openDay(d.date, false))}
                    aria-expanded={isSel}
                  >
                    <span className="day-date">
                      {fmtDateJP(d.date)}
                      {favSet.has(d.date) && <span className="day-badge" aria-label="お気に入り">💕</span>}
                      {memo[d.date] && <span className="day-badge" aria-label="メモあり">📝</span>}
                      <small>{fmtWeekday(d.date)}曜日</small>
                    </span>
                    <span className="day-spark">
                      <MiniBars values={hours} color="var(--a)" />
                    </span>
                    <span className="day-total">
                      {fmtInt(d.total)} 件
                      <small>
                        {chat.names.a} {d.a}・{chat.names.b} {d.b}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
            {rows.length > limit && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button type="button" className="btn" onClick={() => setLimit((n) => n + 60)}>
                  さらに表示（残り {rows.length - limit} 日）
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {selected && (
        <div ref={detailRef} style={{ scrollMarginTop: 16 }}>
          <Card>
            <CardHead
              title={`${selected.slice(0, 4)}年${fmtDateJP(selected)}（${WEEKDAY_LABELS[weekdayOf(selected)]}）`}
              sub={`${selectedMessages.length} 件のメッセージ`}
              icon="message"
              right={
                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={favSet.has(selected)}
                    onClick={() => toggleFav(selected)}
                  >
                    <Icon name="heart" size={14} filled={favSet.has(selected)} />
                    {favSet.has(selected) ? "お気に入り済み" : "お気に入り"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)} aria-label="閉じる">
                    <Icon name="close" size={14} />
                  </button>
                </div>
              }
            />
            <label className="field" style={{ marginBottom: 14 }}>
              <span className="field-label">この日のメモ</span>
              <textarea
                className="input memo-input"
                rows={2}
                placeholder="この日の思い出を書いておけます（この端末だけに保存されます）"
                value={memoDraft}
                onChange={(e) => setMemoDraft(e.target.value)}
                onBlur={() => saveMemo(selected, memoDraft)}
              />
            </label>
            {selectedMessages.length === 0 ? (
              <EmptyState icon="message" title="この日には表示できるメッセージがありません" />
            ) : (
              <div className="msg-list" style={{ maxHeight: 460, overflowY: "auto" }}>
                {selectedMessages.map((m, i) => (
                  <div className="msg-row" key={i}>
                    <span className="msg-date">{m.time}</span>
                    <span className={`msg-sender ${m.sender === chat.names.a ? "a" : "b"}`}>{m.sender}</span>
                    <span className={`msg-text ${m.type !== "text" ? "msg-type" : ""}`}>{m.content}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
